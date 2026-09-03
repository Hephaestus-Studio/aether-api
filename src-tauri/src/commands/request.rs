use crate::commands::workspace::{get_last_seq_in_dir, AppState};
use crate::engine::variable_resolver::VariableResolver;
use crate::errors::AppError;
use crate::models::request::Request;
use crate::models::response::HttpResponse;
use serde::Serialize;
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

/// Response payload returned after creating a new request.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRequestResult {
    /// The relative path ID of the new request file.
    pub id: String,
    /// The absolute filesystem path to the new request file.
    pub path: String,
    /// The display name of the request.
    pub name: String,
    /// The generated fractional sequence index.
    pub seq: String,
}

/// Tauri command to create a new request configuration file using a UUID v7 filename.
///
/// Generates a UUID v7-based filename to ensure uniqueness and avoid naming conflicts.
/// The display name is stored inside the YAML content.
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if no workspace is opened.
#[tauri::command]
pub async fn create_request(
    parent_path: String,
    name: String,
    state: State<'_, AppState>,
) -> Result<CreateRequestResult, AppError> {
    tracing::info!("Creating request '{}' in '{}'", name, parent_path);
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let parent = if Path::new(&parent_path).is_absolute() {
        PathBuf::from(&parent_path)
    } else {
        ws_state.path.join(&parent_path)
    };

    let uuid = uuid::Uuid::now_v7();
    let filename = format!("{}.yml", uuid);
    let file_path = parent.join(&filename);

    let last_seq = get_last_seq_in_dir(&parent);
    let new_seq =
        crate::engine::fractional_index::FractionalIndexer::generate_last(last_seq.as_deref());

    let mut req = Request::new(&name);
    req.seq = Some(new_seq.clone());

    crate::engine::yaml_parser::atomic_write_yaml(&file_path, &req)?;

    let id = file_path
        .strip_prefix(&ws_state.path)
        .unwrap_or(&file_path)
        .to_string_lossy()
        .to_string();

    tracing::info!("Created request '{}' at {}", name, file_path.display());

    Ok(CreateRequestResult {
        id,
        path: file_path.to_string_lossy().to_string(),
        name,
        seq: new_seq,
    })
}

/// Tauri command to update and write a request configuration file back to disk atomically.
///
/// Refreshes the request's internal `updated_at` time stamp.
/// The file is never renamed — request files use UUID v7 filenames for their entire lifecycle.
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

    if file_path.exists() {
        if let Ok(existing) =
            crate::engine::yaml_parser::read_and_validate_yaml::<Request>(&file_path)
        {
            if existing.content_equals(&request_details) {
                tracing::debug!(
                    "Request content unchanged for {}, skipping file write",
                    file_path.display()
                );
                return Ok(());
            }
            // Preserve original created_at timestamp
            request_details.created_at = existing.created_at;
        }
    }

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
    request_details: Option<Request>,
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

    let abs_file_path = if Path::new(&request_path).is_absolute() {
        PathBuf::from(&request_path)
    } else {
        ws_state.path.join(&request_path)
    };

    let request: Request = if let Some(details) = request_details {
        details
    } else {
        crate::engine::yaml_parser::read_and_validate_yaml(&abs_file_path)?
    };

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

    // Collect inherited headers from collection/ancestor folders
    let mut merged_headers = collect_inherited_headers(&abs_file_path, &ws_state.path);
    for req_h in request.headers {
        if let Some(pos) = merged_headers
            .iter()
            .position(|existing| existing.key.eq_ignore_ascii_case(&req_h.key))
        {
            merged_headers[pos] = req_h;
        } else {
            merged_headers.push(req_h);
        }
    }

    let mut resolved_headers = Vec::new();
    for h in &merged_headers {
        let rk = VariableResolver::resolve_string(&h.key, &vars_ref)?;
        let rv = VariableResolver::resolve_string(&h.value, &vars_ref)?;
        resolved_headers.push(crate::models::request::KeyValuePair {
            key: rk,
            value: rv,
            enabled: h.enabled,
            description: h.description.clone(),
        });
    }

    // Resolve Auth (with inheritance if AuthConfig::Inherit)
    let raw_auth = if matches!(request.auth, crate::models::request::AuthConfig::Inherit) {
        resolve_inherited_auth(&abs_file_path, &ws_state.path)
    } else {
        request.auth.clone()
    };

    let resolved_auth = match &raw_auth {
        crate::models::request::AuthConfig::Bearer { bearer } => {
            let r_token = VariableResolver::resolve_string(&bearer.token, &vars_ref)?;
            let r_prefix = match &bearer.prefix {
                Some(p) => Some(VariableResolver::resolve_string(p, &vars_ref)?),
                None => None,
            };
            crate::models::request::AuthConfig::Bearer {
                bearer: crate::models::request::BearerAuth {
                    token: r_token,
                    prefix: r_prefix,
                },
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
        crate::models::request::AuthConfig::ApiKey { apikey } => {
            let r_key = VariableResolver::resolve_string(&apikey.key, &vars_ref)?;
            let r_val = VariableResolver::resolve_string(&apikey.value, &vars_ref)?;
            crate::models::request::AuthConfig::ApiKey {
                apikey: crate::models::request::ApiKeyAuth {
                    key: r_key,
                    value: r_val,
                    add_to: apikey.add_to.clone(),
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
        crate::models::request::RequestBody::Binary { file_path } => {
            let rpath = VariableResolver::resolve_string(file_path, &vars_ref)?;
            crate::models::request::RequestBody::Binary { file_path: rpath }
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

/// Helper function to retrieve all environment variables for resolution (global + active environment file).
pub(crate) async fn get_all_variables(
    workspace_path: &Path,
    env_name: Option<&str>,
) -> Result<HashMap<String, crate::models::environment::Variable>, AppError> {
    let mut variables = HashMap::new();

    // 1. Load global environment if exists
    let global_vars = load_environment_variables(workspace_path, "global").await?;
    for (k, v) in global_vars {
        variables.insert(k, v);
    }

    // 2. Load active environment if provided and not global
    if let Some(name) = env_name {
        if !name.eq_ignore_ascii_case("global") {
            let active_vars = load_environment_variables(workspace_path, name).await?;
            for (k, v) in active_vars {
                variables.insert(k, v);
            }
        }
    }

    // 3. Fallback: also merge any legacy .env if exists for smooth migration
    let legacy_vars = crate::commands::environment::read_legacy_dot_env(
        workspace_path,
        env_name.unwrap_or("global"),
    );
    for (k, v) in legacy_vars {
        variables
            .entry(k.clone())
            .or_insert_with(|| crate::models::environment::Variable {
                name: k,
                value: v,
                var_type: crate::models::environment::VariableType::Default,
                enabled: true,
                description: None,
            });
    }

    Ok(variables)
}

/// Helper function to load and parse environment variable files (`environments/{env_name}.yml`),
/// decrypting secret variables in memory using Master Key if available.
async fn load_environment_variables(
    workspace_path: &Path,
    env_name: &str,
) -> Result<HashMap<String, crate::models::environment::Variable>, AppError> {
    let env_file =
        match crate::commands::environment::find_environment_file(workspace_path, env_name) {
            Some(p) => p,
            None => return Ok(HashMap::new()),
        };

    let env: crate::models::environment::Environment =
        crate::engine::yaml_parser::read_and_validate_yaml(&env_file)?;

    let master_key = crate::engine::key_manager::get_master_key(workspace_path);
    let ws_salt = crate::commands::workspace::ensure_workspace_salt(workspace_path)?;
    let legacy_salt = workspace_path.to_string_lossy().as_bytes().to_vec();

    let mut map = HashMap::new();
    for mut var in env.variables {
        if matches!(
            var.var_type,
            crate::models::environment::VariableType::Secret
        ) && crate::engine::crypto::is_encrypted(&var.value)
        {
            if let Some(ref key) = master_key {
                if let Ok(decrypted) = crate::engine::crypto::decrypt_secret_with_fallback(
                    &var.value,
                    key,
                    &ws_salt,
                    Some(&legacy_salt),
                ) {
                    var.value = decrypted;
                }
            }
        }
        map.insert(var.name.clone(), var);
    }
    Ok(map)
}

/// Tauri command to save a response body (binary base64 or text) directly to a file path.
#[tauri::command]
pub async fn save_response_to_file(
    file_path: String,
    content: String,
    is_binary: bool,
) -> Result<(), AppError> {
    tracing::info!("Saving response to file: {}", file_path);
    let path = PathBuf::from(&file_path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(AppError::Io)?;
    }

    if is_binary {
        use base64::Engine as _;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(&content)
            .map_err(|e| {
                AppError::SchemaValidationError(format!("Failed to decode base64: {}", e))
            })?;
        std::fs::write(&path, &bytes).map_err(AppError::Io)?;
    } else {
        std::fs::write(&path, content.as_bytes()).map_err(AppError::Io)?;
    }

    tracing::info!("Successfully saved response to {}", file_path);
    Ok(())
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct InheritedContext {
    pub headers: Vec<crate::models::request::KeyValuePair>,
    pub auth: crate::models::request::AuthConfig,
}

/// Tauri command to resolve inherited headers and auth for a given request path.
#[tauri::command]
pub async fn resolve_inherited_context(
    request_path: String,
    state: State<'_, AppState>,
) -> Result<InheritedContext, AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let abs_file_path = if Path::new(&request_path).is_absolute() {
        PathBuf::from(&request_path)
    } else {
        ws_state.path.join(&request_path)
    };

    let headers = collect_inherited_headers(&abs_file_path, &ws_state.path);
    let auth = resolve_inherited_auth(&abs_file_path, &ws_state.path);

    Ok(InheritedContext { headers, auth })
}

/// Helper function to resolve inherited authentication configuration by walking up the directory tree
/// from the request's parent directory up to the workspace root.
pub fn resolve_inherited_auth(
    abs_request_path: &Path,
    workspace_root: &Path,
) -> crate::models::request::AuthConfig {
    let mut cur = if abs_request_path.is_file() {
        abs_request_path.parent()
    } else {
        Some(abs_request_path)
    };

    while let Some(dir) = cur {
        if !dir.starts_with(workspace_root) || dir == workspace_root {
            break;
        }

        // 1. Check folder.yml / folder.yaml
        let fold_yml = dir.join("folder.yml");
        let fold_yaml = dir.join("folder.yaml");
        let fold_file = if fold_yml.exists() {
            Some(fold_yml)
        } else if fold_yaml.exists() {
            Some(fold_yaml)
        } else {
            None
        };

        if let Some(f) = fold_file {
            if let Ok(fold) = crate::engine::yaml_parser::read_and_validate_yaml::<
                crate::models::folder::Folder,
            >(&f)
            {
                if let Some(auth) = fold.auth {
                    if !matches!(auth, crate::models::request::AuthConfig::Inherit) {
                        return auth;
                    }
                }
            }
        }

        // 2. Check collection.yml / collection.yaml
        let col_yml = dir.join("collection.yml");
        let col_yaml = dir.join("collection.yaml");
        let col_file = if col_yml.exists() {
            Some(col_yml)
        } else if col_yaml.exists() {
            Some(col_yaml)
        } else {
            None
        };

        if let Some(c) = col_file {
            if let Ok(col) = crate::engine::yaml_parser::read_and_validate_yaml::<
                crate::models::collection::Collection,
            >(&c)
            {
                if let Some(auth) = col.auth {
                    if !matches!(auth, crate::models::request::AuthConfig::Inherit) {
                        return auth;
                    }
                }
            }
            break; // Stop at collection root
        }

        cur = dir.parent();
    }

    crate::models::request::AuthConfig::None
}

/// Helper function to collect inherited headers from collection root down through intermediate folders.
pub fn collect_inherited_headers(
    abs_request_path: &Path,
    workspace_root: &Path,
) -> Vec<crate::models::request::KeyValuePair> {
    let mut inherited_headers: Vec<crate::models::request::KeyValuePair> = Vec::new();
    let mut dirs = Vec::new();
    let mut cur = if abs_request_path.is_file() {
        abs_request_path.parent()
    } else {
        Some(abs_request_path)
    };

    while let Some(d) = cur {
        if !d.starts_with(workspace_root) || d == workspace_root {
            break;
        }
        dirs.push(d.to_path_buf());
        let col_yml = d.join("collection.yml");
        let col_yaml = d.join("collection.yaml");
        if col_yml.exists() || col_yaml.exists() {
            break; // Stop at collection root
        }
        cur = d.parent();
    }

    // Reverse so collection root is processed first, followed by subfolders down to direct parent
    dirs.reverse();

    for d in dirs {
        let col_yml = d.join("collection.yml");
        let col_yaml = d.join("collection.yaml");
        let fold_yml = d.join("folder.yml");
        let fold_yaml = d.join("folder.yaml");

        let headers_opt = if col_yml.exists() || col_yaml.exists() {
            let f = if col_yml.exists() { col_yml } else { col_yaml };
            crate::engine::yaml_parser::read_and_validate_yaml::<
                crate::models::collection::Collection,
            >(&f)
            .ok()
            .and_then(|c| c.headers)
        } else if fold_yml.exists() || fold_yaml.exists() {
            let f = if fold_yml.exists() {
                fold_yml
            } else {
                fold_yaml
            };
            crate::engine::yaml_parser::read_and_validate_yaml::<crate::models::folder::Folder>(&f)
                .ok()
                .and_then(|fld| fld.headers)
        } else {
            None
        };

        if let Some(hdrs) = headers_opt {
            for h in hdrs {
                if let Some(pos) = inherited_headers
                    .iter()
                    .position(|existing| existing.key.eq_ignore_ascii_case(&h.key))
                {
                    inherited_headers[pos] = h;
                } else {
                    inherited_headers.push(h);
                }
            }
        }
    }

    inherited_headers
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::collection::Collection;
    use crate::models::folder::Folder;
    use crate::models::request::{AuthConfig, BearerAuth, KeyValuePair};
    use tempfile::tempdir;

    #[test]
    fn test_resolve_inherited_auth_hierarchy() {
        let dir = tempdir().unwrap();
        let ws_root = dir.path();

        // 1. Create collection with Bearer auth
        let col_dir = ws_root.join("collections").join("my_col");
        std::fs::create_dir_all(&col_dir).unwrap();

        let mut col = Collection::new("My Collection");
        col.auth = Some(AuthConfig::Bearer {
            bearer: BearerAuth {
                token: "collection-secret-token".to_string(),
                prefix: Some("Bearer".to_string()),
            },
        });
        crate::engine::yaml_parser::atomic_write_yaml(&col_dir.join("collection.yml"), &col)
            .unwrap();

        // 2. Create subfolder with inherit auth
        let fold_dir = col_dir.join("subfolder");
        std::fs::create_dir_all(&fold_dir).unwrap();

        let mut fold = Folder::new("Sub Folder");
        fold.auth = Some(AuthConfig::Inherit);
        crate::engine::yaml_parser::atomic_write_yaml(&fold_dir.join("folder.yml"), &fold).unwrap();

        // 3. Create request path inside subfolder
        let req_file = fold_dir.join("req.yml");

        // Resolve auth for request -> should walk up to collection and find bearer
        let resolved = resolve_inherited_auth(&req_file, ws_root);
        match resolved {
            AuthConfig::Bearer { bearer } => {
                assert_eq!(bearer.token, "collection-secret-token");
            }
            other => panic!("Expected Bearer auth, got {:?}", other),
        }
    }

    #[test]
    fn test_collect_inherited_headers_hierarchy() {
        let dir = tempdir().unwrap();
        let ws_root = dir.path();

        // Collection headers
        let col_dir = ws_root.join("collections").join("col_1");
        std::fs::create_dir_all(&col_dir).unwrap();

        let mut col = Collection::new("Col 1");
        col.headers = Some(vec![
            KeyValuePair {
                key: "X-Collection-Header".to_string(),
                value: "ColVal".to_string(),
                enabled: true,
                description: None,
            },
            KeyValuePair {
                key: "X-Shared".to_string(),
                value: "ColShared".to_string(),
                enabled: true,
                description: None,
            },
        ]);
        crate::engine::yaml_parser::atomic_write_yaml(&col_dir.join("collection.yml"), &col)
            .unwrap();

        // Folder headers (overrides X-Shared)
        let fold_dir = col_dir.join("fold_1");
        std::fs::create_dir_all(&fold_dir).unwrap();

        let mut fold = Folder::new("Fold 1");
        fold.headers = Some(vec![KeyValuePair {
            key: "X-Shared".to_string(),
            value: "FoldOverride".to_string(),
            enabled: true,
            description: None,
        }]);
        crate::engine::yaml_parser::atomic_write_yaml(&fold_dir.join("folder.yml"), &fold).unwrap();

        let req_file = fold_dir.join("test_req.yml");

        let collected = collect_inherited_headers(&req_file, ws_root);
        assert_eq!(collected.len(), 2);
        assert_eq!(collected[0].key, "X-Collection-Header");
        assert_eq!(collected[0].value, "ColVal");
        assert_eq!(collected[1].key, "X-Shared");
        assert_eq!(collected[1].value, "FoldOverride");
    }
}
