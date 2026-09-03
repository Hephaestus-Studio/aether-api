use crate::commands::request::{get_all_variables, resolve_inherited_auth};
use crate::commands::workspace::AppState;
use crate::engine::variable_resolver::VariableResolver;
use crate::engine::websocket_client::{WsMessageEvent, WsMetrics};
use crate::errors::AppError;
use crate::models::request::{AuthConfig, KeyValuePair, Request};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, State};


/// Tauri command to establish a new WebSocket connection.
#[tauri::command]
pub async fn ws_connect(
    tab_id: String,
    request_path: Option<String>,
    request_details: Option<Request>,
    active_environment_name: Option<String>,
    subprotocols: Option<Vec<String>>,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    tracing::info!("Connecting WebSocket for tab: {}", tab_id);

    let (raw_url, raw_params, raw_headers, raw_auth, ws_settings, req_settings, resolved_vars) = {
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
                return Err(AppError::WebSocketError("No request details or path provided".to_string()));
            };

            let variables = get_all_variables(&ws_state.path, active_environment_name.as_deref()).await?;
            let raw_auth = if matches!(req.auth, AuthConfig::Inherit) {
                resolve_inherited_auth(&abs_file_path, &ws_state.path)
            } else {
                req.auth
            };

            (
                req.url,
                req.params,
                req.headers,
                raw_auth,
                req.ws_settings.unwrap_or_default(),
                req.settings,
                Some(variables),
            )
        } else if let Some(req) = request_details {
            (
                req.url,
                req.params,
                req.headers,
                req.auth,
                req.ws_settings.unwrap_or_default(),
                req.settings,
                None,
            )
        } else {
            return Err(AppError::WebSocketError("No workspace or request available".to_string()));
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
    let mut query_pairs = Vec::new();
    for p in &raw_params {
        if p.enabled && !p.key.trim().is_empty() {
            let rk = VariableResolver::resolve_string(&p.key, &vars_ref)?;
            let rv = VariableResolver::resolve_string(&p.value, &vars_ref)?;
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

    let subproto_list = subprotocols.unwrap_or_default();

    state
        .ws_manager
        .connect(
            app_handle,
            tab_id,
            resolved_url,
            resolved_headers,
            subproto_list,
            ws_settings,
            req_settings,
        )
        .await
}

/// Tauri command to send a message over an active WebSocket connection.
#[tauri::command]
pub async fn ws_send_message(
    tab_id: String,
    format: String,
    payload: String,
    active_environment_name: Option<String>,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<WsMessageEvent, AppError> {
    // Resolve environment variables inside payload if present
    let vars = {
        let ws = state.workspace.lock().await;
        if let Some(ws_state) = ws.as_ref() {
            get_all_variables(&ws_state.path, active_environment_name.as_deref()).await.unwrap_or_default()
        } else {
            HashMap::new()
        }
    };

    let resolved_payload = if !vars.is_empty() && (format == "json" || format == "text") {
        let vars_ref: HashMap<String, &crate::models::environment::Variable> =
            vars.iter().map(|(k, v)| (k.clone(), v)).collect();
        VariableResolver::resolve_string(&payload, &vars_ref).unwrap_or(payload)
    } else {
        payload
    };

    state
        .ws_manager
        .send_message(&app_handle, &tab_id, &format, &resolved_payload)
        .await
}

/// Tauri command to send a manual Ping frame.
#[tauri::command]
pub async fn ws_send_ping(
    tab_id: String,
    payload: Option<String>,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    state.ws_manager.send_ping(&app_handle, &tab_id, payload).await
}

/// Tauri command to close/disconnect an active WebSocket connection.
#[tauri::command]
pub async fn ws_disconnect(
    tab_id: String,
    code: Option<u16>,
    reason: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    state.ws_manager.disconnect(&tab_id, code, reason).await
}

/// Tauri command to retrieve real-time statistics/metrics for a WebSocket connection.
#[tauri::command]
pub async fn ws_get_metrics(
    tab_id: String,
    state: State<'_, AppState>,
) -> Result<Option<WsMetrics>, AppError> {
    Ok(state.ws_manager.get_metrics(&tab_id).await)
}
