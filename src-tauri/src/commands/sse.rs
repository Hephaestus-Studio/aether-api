use crate::commands::request::{get_all_variables, resolve_inherited_auth};
use crate::commands::workspace::AppState;
use crate::engine::sse_client::SseMetrics;
use crate::engine::variable_resolver::VariableResolver;
use crate::errors::AppError;
use crate::models::request::{
    AuthConfig, KeyValuePair, MultipartField, Request, RequestBody,
};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, State};

/// Tauri command to establish a new Server-Sent Events (SSE) connection stream.
#[tauri::command]
pub async fn sse_connect(
    tab_id: String,
    request_path: Option<String>,
    request_details: Option<Request>,
    active_environment_name: Option<String>,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    tracing::info!("Connecting SSE stream for tab: {}", tab_id);

    let (raw_method, raw_url, raw_params, raw_headers, raw_body, raw_auth, sse_settings, req_settings, resolved_vars) = {
        let ws = state.workspace.lock().await;
        if let Some(ws_state) = ws.as_ref() {
            let abs_file_path = if let Some(ref p) = request_path {
                if Path::new(p).is_absolute() {
                    PathBuf::from(p)
                } else {
                    ws_state.path.join(p)
                }
            } else {
                ws_state.path.clone()
            };

            let req = if let Some(details) = request_details {
                details
            } else if let Some(ref p) = request_path {
                let path = if Path::new(p).is_absolute() {
                    PathBuf::from(p)
                } else {
                    ws_state.path.join(p)
                };
                crate::engine::yaml_parser::read_and_validate_yaml(&path)?
            } else {
                return Err(AppError::SseError("No request details or path provided".to_string()));
            };

            let variables = get_all_variables(&ws_state.path, active_environment_name.as_deref()).await?;
            let raw_auth = if matches!(req.auth, AuthConfig::Inherit) {
                resolve_inherited_auth(&abs_file_path, &ws_state.path)
            } else {
                req.auth
            };

            (
                req.method,
                req.url,
                req.params,
                req.headers,
                req.body,
                raw_auth,
                req.sse_settings.unwrap_or_default(),
                req.settings,
                Some(variables),
            )
        } else if let Some(req) = request_details {
            (
                req.method,
                req.url,
                req.params,
                req.headers,
                req.body,
                req.auth,
                req.sse_settings.unwrap_or_default(),
                req.settings,
                None,
            )
        } else {
            return Err(AppError::SseError("No workspace or request available".to_string()));
        }
    };

    // Interpolate environment variables
    let empty_map = HashMap::new();
    let vars = resolved_vars.unwrap_or_default();
    let vars_ref: HashMap<String, &crate::models::environment::Variable> =
        if vars.is_empty() {
            empty_map
        } else {
            vars.iter().map(|(k, v)| (k.clone(), v)).collect()
        };

    let mut resolved_url = VariableResolver::resolve_string(&raw_url, &vars_ref)?;

    // Append enabled query parameters
    let mut resolved_params = Vec::new();
    let mut query_pairs = Vec::new();
    for p in &raw_params {
        if p.enabled && !p.key.trim().is_empty() {
            let rk = VariableResolver::resolve_string(&p.key, &vars_ref)?;
            let rv = VariableResolver::resolve_string(&p.value, &vars_ref)?;
            resolved_params.push(KeyValuePair {
                key: rk.clone(),
                value: rv.clone(),
                enabled: true,
                description: p.description.clone(),
            });
            query_pairs.push((rk, rv));
        }
    }

    if !query_pairs.is_empty() {
        if let Ok(mut parsed_url) = url::Url::parse(&resolved_url) {
            for (k, v) in query_pairs {
                parsed_url.query_pairs_mut().append_pair(&k, &v);
            }
            resolved_url = parsed_url.to_string();
        }
    }

    // Resolve custom headers
    let mut resolved_headers = Vec::new();
    for h in &raw_headers {
        if h.enabled && !h.key.trim().is_empty() {
            let rk = VariableResolver::resolve_string(&h.key, &vars_ref)?;
            let rv = VariableResolver::resolve_string(&h.value, &vars_ref)?;
            resolved_headers.push(KeyValuePair {
                key: rk,
                value: rv,
                enabled: true,
                description: h.description.clone(),
            });
        }
    }

    // Attach Auth headers/query
    match raw_auth {
        AuthConfig::Bearer { bearer } => {
            let token = VariableResolver::resolve_string(&bearer.token, &vars_ref)?;
            let prefix = match &bearer.prefix {
                Some(p) if !p.trim().is_empty() => VariableResolver::resolve_string(p, &vars_ref)?,
                _ => "Bearer".to_string(),
            };
            let auth_val = if prefix.is_empty() {
                token
            } else {
                format!("{} {}", prefix, token)
            };
            resolved_headers.push(KeyValuePair::new("Authorization", auth_val));
        }
        AuthConfig::Basic { basic } => {
            let u = VariableResolver::resolve_string(&basic.username, &vars_ref)?;
            let p = VariableResolver::resolve_string(&basic.password, &vars_ref)?;
            let credentials = format!("{}:{}", u, p);
            let encoded = BASE64.encode(credentials.as_bytes());
            resolved_headers.push(KeyValuePair::new("Authorization", format!("Basic {}", encoded)));
        }
        AuthConfig::ApiKey { apikey } => {
            let k = VariableResolver::resolve_string(&apikey.key, &vars_ref)?;
            let v = VariableResolver::resolve_string(&apikey.value, &vars_ref)?;
            if !k.is_empty() {
                if apikey.add_to == "query" {
                    if let Ok(mut parsed_url) = url::Url::parse(&resolved_url) {
                        parsed_url.query_pairs_mut().append_pair(&k, &v);
                        resolved_url = parsed_url.to_string();
                    }
                } else {
                    resolved_headers.push(KeyValuePair::new(k, v));
                }
            }
        }
        _ => {}
    }

    // Resolve Request Body if method is POST/PUT/PATCH
    let resolved_body = match raw_body {
        RequestBody::Json { content } => RequestBody::Json {
            content: VariableResolver::resolve_string(&content, &vars_ref)?,
        },
        RequestBody::Text { content } => RequestBody::Text {
            content: VariableResolver::resolve_string(&content, &vars_ref)?,
        },
        RequestBody::FormUrlencoded { content } => {
            let mut resolved_list = Vec::new();
            for kv in content {
                if kv.enabled {
                    resolved_list.push(KeyValuePair {
                        key: VariableResolver::resolve_string(&kv.key, &vars_ref)?,
                        value: VariableResolver::resolve_string(&kv.value, &vars_ref)?,
                        enabled: true,
                        description: kv.description,
                    });
                }
            }
            RequestBody::FormUrlencoded {
                content: resolved_list,
            }
        }
        RequestBody::MultipartForm { content } => {
            let mut resolved_fields = Vec::new();
            for f in content {
                if f.enabled {
                    resolved_fields.push(MultipartField {
                        key: VariableResolver::resolve_string(&f.key, &vars_ref)?,
                        value: VariableResolver::resolve_string(&f.value, &vars_ref)?,
                        field_type: f.field_type,
                        enabled: true,
                    });
                }
            }
            RequestBody::MultipartForm {
                content: resolved_fields,
            }
        }
        other => other,
    };

    state
        .sse_manager
        .connect(
            app_handle,
            tab_id,
            raw_method,
            resolved_url,
            resolved_params,
            resolved_headers,
            resolved_body,
            AuthConfig::None, // Auth already injected into headers/URL
            sse_settings,
            req_settings,
        )
        .await
}

/// Tauri command to disconnect an active SSE connection.
#[tauri::command]
pub async fn sse_disconnect(
    tab_id: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    tracing::info!("Disconnecting SSE for tab: {}", tab_id);
    state.sse_manager.disconnect(&tab_id).await
}

/// Tauri command to retrieve current metrics for an SSE stream.
#[tauri::command]
pub async fn sse_get_metrics(
    tab_id: String,
    state: State<'_, AppState>,
) -> Result<SseMetrics, AppError> {
    Ok(state.sse_manager.get_metrics(&tab_id).await)
}
