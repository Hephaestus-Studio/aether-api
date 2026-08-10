use crate::commands::workspace::AppState;
use crate::engine::variable_resolver::VariableResolver;
use crate::errors::AppError;
use crate::models::request::Request;
use crate::models::response::HttpResponse;
use serde_json::json;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::Emitter;
use tauri::State;
use tokio_util::sync::CancellationToken;

/// Tauri command to read a request configuration file from disk.
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if no workspace is opened,
/// or [`AppError::Io`] if the file cannot be read.
#[tauri::command]
pub async fn read_request(path: String, state: State<'_, AppState>) -> Result<Request, AppError> {
    tracing::debug!("Reading request configuration: {}", path);
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let file_path = if Path::new(&path).is_absolute() {
        PathBuf::from(&path)
    } else {
        ws_state.path.join(&path)
    };
    let request: Request = crate::engine::yaml_parser::read_and_validate_yaml(&file_path)?;
    Ok(request)
}

/// Tauri command to update and write a request configuration file back to disk atomically.
///
/// Refreshes the request's internal `updated_at` time stamp.
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if no workspace is opened,
/// or [`AppError::Io`] if atomic writing fails.
#[tauri::command]
pub async fn update_request(
    path: String,
    mut request_details: Request,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    tracing::info!("Updating request configuration: {}", path);
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let file_path = if Path::new(&path).is_absolute() {
        PathBuf::from(&path)
    } else {
        ws_state.path.join(&path)
    };
    request_details.updated_at = chrono::Utc::now();
    crate::engine::yaml_parser::atomic_write_yaml(&file_path, &request_details)?;
    tracing::debug!(
        "Successfully wrote updated request to {}",
        file_path.display()
    );
    Ok(())
}

/// Tauri command to execute a request on a background thread.
///
/// Resolves all environment template variables, updates tracking progress, runs the request,
/// and returns the client [`HttpResponse`].
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if no workspace is opened,
/// or network connectivity errors if execution fails.
#[tauri::command]
pub async fn execute_request(
    request_path: String,
    active_environment_name: Option<String>,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<HttpResponse, AppError> {
    tracing::info!(
        "Executing request: {} (active env: {:?})",
        request_path,
        active_environment_name
    );
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let file_path = if Path::new(&request_path).is_absolute() {
        PathBuf::from(&request_path)
    } else {
        ws_state.path.join(&request_path)
    };
    let request: Request = crate::engine::yaml_parser::read_and_validate_yaml(&file_path)?;

    let variables = get_all_variables(&ws_state.path, active_environment_name.as_deref()).await?;
    let vars_ref: HashMap<String, &crate::models::environment::Variable> =
        variables.iter().map(|(k, v)| (k.clone(), v)).collect();

    let resolved_url = VariableResolver::resolve_string(&request.url, &vars_ref)?;

    let mut resolved_params = Vec::new();
    for p in &request.params {
        let rk = VariableResolver::resolve_string(&p.key, &vars_ref)?;
        let rv = VariableResolver::resolve_string(&p.value, &vars_ref)?;
        resolved_params.push(crate::models::request::KeyValuePair {
            key: rk,
            value: rv,
            enabled: p.enabled,
            description: p.description.clone(),
        });
    }

    let mut resolved_headers = Vec::new();
    for h in &request.headers {
        let rk = VariableResolver::resolve_string(&h.key, &vars_ref)?;
        let rv = VariableResolver::resolve_string(&h.value, &vars_ref)?;
        resolved_headers.push(crate::models::request::KeyValuePair {
            key: rk,
            value: rv,
            enabled: h.enabled,
            description: h.description.clone(),
        });
    }

    let resolved_auth = match &request.auth {
        crate::models::request::AuthConfig::Bearer { bearer } => {
            let r_token = VariableResolver::resolve_string(&bearer.token, &vars_ref)?;
            crate::models::request::AuthConfig::Bearer {
                bearer: crate::models::request::BearerAuth { token: r_token },
            }
        }
        crate::models::request::AuthConfig::Basic { basic } => {
            let r_user = VariableResolver::resolve_string(&basic.username, &vars_ref)?;
            let r_pass = VariableResolver::resolve_string(&basic.password, &vars_ref)?;
            crate::models::request::AuthConfig::Basic {
                basic: crate::models::request::BasicAuth {
                    username: r_user,
                    password: r_pass,
                },
            }
        }
        other => other.clone(),
    };

    let resolved_body = match &request.body {
        crate::models::request::RequestBody::None { content } => {
            let rc = if let Some(c) = content {
                Some(VariableResolver::resolve_string(c, &vars_ref)?)
            } else {
                None
            };
            crate::models::request::RequestBody::None { content: rc }
        }
        crate::models::request::RequestBody::Json { content } => {
            let rc = VariableResolver::resolve_string(content, &vars_ref)?;
            crate::models::request::RequestBody::Json { content: rc }
        }
        crate::models::request::RequestBody::Xml { content } => {
            let rc = VariableResolver::resolve_string(content, &vars_ref)?;
            crate::models::request::RequestBody::Xml { content: rc }
        }
        crate::models::request::RequestBody::Text { content } => {
            let rc = VariableResolver::resolve_string(content, &vars_ref)?;
            crate::models::request::RequestBody::Text { content: rc }
        }
        crate::models::request::RequestBody::Yaml { content } => {
            let rc = VariableResolver::resolve_string(content, &vars_ref)?;
            crate::models::request::RequestBody::Yaml { content: rc }
        }
        crate::models::request::RequestBody::FormUrlencoded { content } => {
            let mut rp = Vec::new();
            for kv in content {
                let rk = VariableResolver::resolve_string(&kv.key, &vars_ref)?;
                let rv = VariableResolver::resolve_string(&kv.value, &vars_ref)?;
                rp.push(crate::models::request::KeyValuePair {
                    key: rk,
                    value: rv,
                    enabled: kv.enabled,
                    description: kv.description.clone(),
                });
            }
            crate::models::request::RequestBody::FormUrlencoded { content: rp }
        }
        crate::models::request::RequestBody::MultipartForm { content } => {
            let mut rf = Vec::new();
            for f in content {
                let rk = VariableResolver::resolve_string(&f.key, &vars_ref)?;
                let rv = VariableResolver::resolve_string(&f.value, &vars_ref)?;
                rf.push(crate::models::request::MultipartField {
                    key: rk,
                    value: rv,
                    field_type: f.field_type.clone(),
                    enabled: f.enabled,
                });
            }
            crate::models::request::RequestBody::MultipartForm { content: rf }
        }
    };

    let resolved_request = Request {
        url: resolved_url.clone(),
        params: resolved_params,
        headers: resolved_headers,
        auth: resolved_auth,
        body: resolved_body,
        ..request
    };

    let mut final_url = resolved_url.clone();
    let enabled_params: Vec<(&str, &str)> = resolved_request
        .params
        .iter()
        .filter(|p| p.enabled && !p.key.trim().is_empty())
        .map(|p| (p.key.as_str(), p.value.as_str()))
        .collect();
    if !enabled_params.is_empty() && !final_url.contains('?') {
        if let Ok(mut parsed_url) = reqwest::Url::parse(&final_url) {
            parsed_url.query_pairs_mut().extend_pairs(enabled_params);
            final_url = parsed_url.to_string();
        }
    }

    tracing::info!(
        "Sending HTTP {} request to {}",
        resolved_request.method,
        final_url
    );

    let cancel_token = CancellationToken::new();
    state.request_tracker.remove(&request_path).await;
    state
        .request_tracker
        .register_with_id(request_path.clone(), cancel_token.clone())
        .await;

    let _ = app_handle.emit(
        "request-progress",
        json!({
            "requestPath": request_path,
            "phase": "connecting",
            "percentComplete": 30
        }),
    );

    let response = state
        .http_executor
        .execute(&resolved_request, cancel_token)
        .await;

    state.request_tracker.remove(&request_path).await;

    match &response {
        Ok(res) => {
            tracing::info!(
                "Request [{}] completed with status {} {} in {:.2} ms",
                resolved_request.method,
                res.status,
                res.status_text,
                res.timing.total_ms
            );
        }
        Err(err) => {
            tracing::error!("Request execution failed for {}: {:?}", request_path, err);
        }
    }

    response
}

/// Tauri command to cancel an active running request.
///
/// # Errors
/// Returns [`AppError::ItemNotFound`] if the request is not currently active.
#[tauri::command]
pub async fn cancel_request(
    request_path: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    tracing::info!("Cancelling request execution: {}", request_path);
    if state.request_tracker.cancel(&request_path).await {
        tracing::info!("Request {} cancelled successfully", request_path);
        Ok(())
    } else {
        tracing::warn!("Failed to cancel request {}: not running", request_path);
        Err(AppError::ItemNotFound(format!(
            "Request '{}' is not running",
            request_path
        )))
    }
}

/// Helper function to retrieve all environment variables for resolution (dot-env + active environment file).
async fn get_all_variables(
    workspace_path: &Path,
    env_name: Option<&str>,
) -> Result<HashMap<String, crate::models::environment::Variable>, AppError> {
    let mut variables = load_dot_env(workspace_path, env_name);

    if let Some(name) = env_name {
        let env_vars = load_environment_variables(workspace_path, name).await?;
        for (k, mut v) in env_vars {
            if v.value == format!("{{{{{}}}}}", k) || v.value == format!("{{{{ {} }}}}", k) {
                if let Some(dot_val) = variables.get(&k) {
                    v.value = dot_val.value.clone();
                }
            }
            variables.insert(k, v);
        }
    }

    Ok(variables)
}

/// Helper function to load key-value variables from the workspace `.env` and `.env.<name>` files.
fn load_dot_env(
    workspace_path: &Path,
    env_name: Option<&str>,
) -> HashMap<String, crate::models::environment::Variable> {
    let mut map = HashMap::new();

    // Load global .env first
    parse_env_file_into_var_map(&workspace_path.join(".env"), &mut map);

    // Load specific .env.<name> if provided
    if let Some(name) = env_name {
        let specific_env_path =
            crate::commands::environment::get_dot_env_path(workspace_path, name);
        if specific_env_path != workspace_path.join(".env") {
            parse_env_file_into_var_map(&specific_env_path, &mut map);
        }
    }

    map
}

fn parse_env_file_into_var_map(
    file_path: &Path,
    map: &mut HashMap<String, crate::models::environment::Variable>,
) {
    if file_path.exists() {
        if let Ok(content) = std::fs::read_to_string(file_path) {
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() || trimmed.starts_with('#') {
                    continue;
                }
                if let Some((k, v)) = trimmed.split_once('=') {
                    let key = k.trim().to_string();
                    let val = v.trim().trim_matches('"').trim_matches('\'').to_string();
                    map.insert(
                        key.clone(),
                        crate::models::environment::Variable {
                            name: key,
                            value: val,
                            var_type: crate::models::environment::VariableType::Default,
                            enabled: true,
                            description: Some(format!(
                                "From {}",
                                file_path
                                    .file_name()
                                    .and_then(|n| n.to_str())
                                    .unwrap_or(".env")
                            )),
                        },
                    );
                }
            }
        }
    }
}

/// Helper function to load and parse environment variable files (`environments/{env_name}.yml`).
async fn load_environment_variables(
    workspace_path: &Path,
    env_name: &str,
) -> Result<HashMap<String, crate::models::environment::Variable>, AppError> {
    let env_file_yml = workspace_path
        .join("environments")
        .join(format!("{}.yml", env_name));
    let env_file_yaml = workspace_path
        .join("environments")
        .join(format!("{}.yaml", env_name));

    let env_file = if env_file_yml.exists() {
        env_file_yml
    } else if env_file_yaml.exists() {
        env_file_yaml
    } else {
        return Ok(HashMap::new());
    };

    let env: crate::models::environment::Environment =
        crate::engine::yaml_parser::read_and_validate_yaml(&env_file)?;

    let mut map = HashMap::new();
    for var in env.variables {
        map.insert(var.name.clone(), var);
    }
    Ok(map)
}
