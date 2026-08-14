use crate::commands::workspace::{sanitize_name, AppState};
use crate::engine::crypto;
use crate::engine::key_manager;
use crate::errors::AppError;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::State;

/// Describes a single environment variable entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvVariableItem {
    /// The variable key/name.
    pub key: String,
    /// The variable value (decrypted plaintext or locked placeholder).
    pub value: String,
    /// The format type of the variable: "default" | "text" or "secret".
    #[serde(rename = "type")]
    pub var_type: String,
    /// Whether the variable is active.
    pub enabled: bool,
    /// True if the variable is encrypted and locked (no Master Key provided to decrypt).
    #[serde(default, rename = "isLocked")]
    pub is_locked: bool,
}

/// Detailed description payload of an environment.
#[derive(Debug, Clone, Serialize)]
pub struct EnvironmentDetails {
    /// Name of the environment.
    pub name: String,
    /// Collection list of environment variables.
    pub variables: Vec<EnvVariableItem>,
}

/// Summary overview describing an environment configuration file.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentSummary {
    /// Name of the environment.
    pub name: String,
    /// Absolute path to the configuration file.
    pub path: String,
    /// Whether this environment contains any sensitive/secret variables.
    pub is_secret_masked: bool,
}

/// Master Key status payload for the active workspace.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MasterKeyStatus {
    /// True if a Master Key is currently configured / unlocked in this session or local disk.
    pub has_master_key: bool,
    /// True if any environment in the workspace contains encrypted secrets.
    pub has_encrypted_secrets: bool,
    /// True if legacy `.env` or `.env.*` files exist in workspace root.
    pub has_legacy_dotenv: bool,
}

/// Helper to locate the environment YAML file trying sanitized name first, then raw name.
pub fn find_environment_file(workspace_path: &Path, name: &str) -> Option<PathBuf> {
    let env_dir = workspace_path.join("environments");
    let sanitized = sanitize_name(name);

    let path = env_dir.join(format!("{}.yml", sanitized));
    if path.exists() {
        return Some(path);
    }
    let path = env_dir.join(format!("{}.yaml", sanitized));
    if path.exists() {
        return Some(path);
    }
    let path = env_dir.join(format!("{}.yml", name));
    if path.exists() {
        return Some(path);
    }
    let path = env_dir.join(format!("{}.yaml", name));
    if path.exists() {
        return Some(path);
    }

    None
}

/// Checks if any legacy `.env` or `.env.*` files exist at workspace root.
pub fn check_legacy_dotenv_files(workspace_path: &Path) -> bool {
    let global_env = workspace_path.join(".env");
    if global_env.exists() {
        return true;
    }

    if let Ok(entries) = std::fs::read_dir(workspace_path) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with(".env.") {
                return true;
            }
        }
    }

    false
}

/// Reads key-value pairs from legacy global `.env` merged with specific `.env.<env_name>`.
pub fn read_legacy_dot_env(workspace_path: &Path, env_name: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();

    // Read global .env first
    let global_env = workspace_path.join(".env");
    if global_env.exists() {
        if let Ok(content) = std::fs::read_to_string(&global_env) {
            parse_env_content(&content, &mut map);
        }
    }

    // Read environment specific .env.<env_name>
    let sanitized = sanitize_name(env_name);
    let env_path = workspace_path.join(format!(".env.{}", sanitized));
    if env_path.exists() && env_path != global_env {
        if let Ok(content) = std::fs::read_to_string(&env_path) {
            parse_env_content(&content, &mut map);
        }
    }

    map
}

fn parse_env_content(content: &str, map: &mut HashMap<String, String>) {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if let Some((k, v)) = trimmed.split_once('=') {
            let key = k.trim().to_string();
            let val = v.trim().trim_matches('"').trim_matches('\'').to_string();
            map.insert(key, val);
        }
    }
}

/// Tauri command to get the Master Key status of the active workspace.
#[tauri::command]
pub async fn get_master_key_status(
    state: State<'_, AppState>,
) -> Result<MasterKeyStatus, AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let has_key = key_manager::get_master_key(&ws_state.path).is_some();
    let has_legacy = check_legacy_dotenv_files(&ws_state.path);

    let mut has_encrypted = false;
    let env_dir = ws_state.path.join("environments");
    if env_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&env_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                    if filename.ends_with(".yml") || filename.ends_with(".yaml") {
                        if let Ok(env) = crate::engine::yaml_parser::read_and_validate_yaml::<
                            crate::models::environment::Environment,
                        >(&path)
                        {
                            if env.variables.iter().any(|v| crypto::is_encrypted(&v.value)) {
                                has_encrypted = true;
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(MasterKeyStatus {
        has_master_key: has_key,
        has_encrypted_secrets: has_encrypted,
        has_legacy_dotenv: has_legacy,
    })
}

/// Tauri command to set, unlock, or rotate the Master Key in RAM for the active workspace.
#[tauri::command]
pub async fn set_master_key(
    key: String,
    current_key: Option<String>,
    _persist: Option<bool>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let new_key = key.trim().to_string();
    if new_key.is_empty() {
        return Err(AppError::CryptoError("Master Key cannot be empty".into()));
    }

    let salt = ws_state.path.to_string_lossy().as_bytes().to_vec();

    if let Some(existing_key) = key_manager::get_master_key(&ws_state.path) {
        // Workspace already has an active master key in RAM -> changing/rotating key requires validating current_key
        let provided = current_key.unwrap_or_default().trim().to_string();
        if provided.is_empty() {
            return Err(AppError::InvalidMasterKey(
                "Current Master Key is required to change key.".into(),
            ));
        }
        if existing_key.trim() != provided {
            return Err(AppError::InvalidMasterKey(
                "Current Master Key is incorrect.".into(),
            ));
        }

        // Re-encrypt existing secret variables across all environment files with the new key
        let env_dir = ws_state.path.join("environments");
        if env_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&env_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        let is_yaml = path
                            .extension()
                            .and_then(|e| e.to_str())
                            .map(|ext| {
                                ext.eq_ignore_ascii_case("yml") || ext.eq_ignore_ascii_case("yaml")
                            })
                            .unwrap_or(false);
                        if is_yaml {
                            if let Ok(mut env) = crate::engine::yaml_parser::read_and_validate_yaml::<
                                crate::models::environment::Environment,
                            >(&path)
                            {
                                let mut modified = false;
                                for v in &mut env.variables {
                                    if matches!(
                                        v.var_type,
                                        crate::models::environment::VariableType::Secret
                                    ) {
                                        if let Ok(decrypted) =
                                            crypto::decrypt_secret(&v.value, &existing_key, &salt)
                                        {
                                            if let Ok(re_encrypted) =
                                                crypto::encrypt_secret(&decrypted, &new_key, &salt)
                                            {
                                                v.value = re_encrypted;
                                                modified = true;
                                            }
                                        }
                                    }
                                }
                                if modified {
                                    let _ =
                                        crate::engine::yaml_parser::atomic_write_yaml(&path, &env);
                                }
                            }
                        }
                    }
                }
            }
        }
    } else {
        // No active master key in RAM yet -> user is unlocking or setting for the first time.
        // If workspace already has encrypted secrets, verify that the key can decrypt them!
        let env_dir = ws_state.path.join("environments");
        if env_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&env_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        if let Ok(env) = crate::engine::yaml_parser::read_and_validate_yaml::<
                            crate::models::environment::Environment,
                        >(&path)
                        {
                            for v in &env.variables {
                                if matches!(
                                    v.var_type,
                                    crate::models::environment::VariableType::Secret
                                ) && crypto::is_encrypted(&v.value)
                                {
                                    if crypto::decrypt_secret(&v.value, &new_key, &salt).is_err() {
                                        return Err(AppError::InvalidMasterKey(
                                            "The provided Master Key cannot decrypt this workspace's secret variables.".into(),
                                        ));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    key_manager::set_master_key(&ws_state.path, &new_key);
    tracing::info!(
        "Master Key updated in RAM for workspace: {:?}",
        ws_state.path
    );
    Ok(())
}

/// Tauri command to generate a new cryptographically secure random Master Key.
#[tauri::command]
pub async fn generate_master_key() -> Result<String, AppError> {
    Ok(crypto::generate_random_key())
}

/// Tauri command to remove Master Key from RAM for the active workspace.
#[tauri::command]
pub async fn remove_master_key(
    current_key: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    if let Some(existing_key) = key_manager::get_master_key(&ws_state.path) {
        let provided = current_key.unwrap_or_default().trim().to_string();
        if provided.is_empty() {
            return Err(AppError::InvalidMasterKey(
                "Current Master Key is required to clear key from RAM.".into(),
            ));
        }
        if existing_key.trim() != provided {
            return Err(AppError::InvalidMasterKey(
                "Current Master Key is incorrect.".into(),
            ));
        }
    }

    key_manager::delete_master_key(&ws_state.path);
    tracing::info!(
        "Master Key removed from RAM for workspace: {:?}",
        ws_state.path
    );
    Ok(())
}

/// Tauri command to clean up legacy `.env` and `.env.*` files from workspace root.
#[tauri::command]
pub async fn cleanup_legacy_dotenv_files(
    state: State<'_, AppState>,
) -> Result<Vec<String>, AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let mut deleted_files = Vec::new();
    let global_env = ws_state.path.join(".env");
    if global_env.exists() {
        if std::fs::remove_file(&global_env).is_ok() {
            deleted_files.push(".env".to_string());
        }
    }

    if let Ok(entries) = std::fs::read_dir(&ws_state.path) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with(".env.") {
                let p = entry.path();
                if std::fs::remove_file(&p).is_ok() {
                    deleted_files.push(name);
                }
            }
        }
    }

    tracing::info!("Cleaned up legacy .env files: {:?}", deleted_files);
    Ok(deleted_files)
}

/// Tauri command to list all environment summary items in the workspace.
#[tauri::command]
pub async fn list_environments(
    state: State<'_, AppState>,
) -> Result<Vec<EnvironmentSummary>, AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let env_dir = ws_state.path.join("environments");
    if !env_dir.exists() {
        return Ok(Vec::new());
    }

    let mut list = Vec::new();
    let entries = std::fs::read_dir(env_dir)?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if filename.ends_with(".yml") || filename.ends_with(".yaml") {
                if let Ok(env) = crate::engine::yaml_parser::read_and_validate_yaml::<
                    crate::models::environment::Environment,
                >(&path)
                {
                    let has_secrets = env.variables.iter().any(|v| {
                        matches!(v.var_type, crate::models::environment::VariableType::Secret)
                    });
                    list.push(EnvironmentSummary {
                        name: env.name,
                        path: path.to_string_lossy().to_string(),
                        is_secret_masked: has_secrets,
                    });
                }
            }
        }
    }

    Ok(list)
}

/// Tauri command to read and validate a specific environment config by name.
#[tauri::command]
pub async fn read_environment(
    name: String,
    state: State<'_, AppState>,
) -> Result<EnvironmentDetails, AppError> {
    tracing::info!("Reading environment: '{}'", name);
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let env_file = find_environment_file(&ws_state.path, &name)
        .ok_or_else(|| AppError::ItemNotFound(name.clone()))?;

    let env: crate::models::environment::Environment =
        crate::engine::yaml_parser::read_and_validate_yaml(&env_file)?;

    let master_key = key_manager::get_master_key(&ws_state.path);
    let salt = ws_state.path.to_string_lossy().as_bytes().to_vec();

    // Read legacy .env variables in case this workspace is being migrated
    let legacy_map = read_legacy_dot_env(&ws_state.path, &name);

    let mut variables = Vec::new();
    for var in env.variables {
        let is_secret = matches!(
            var.var_type,
            crate::models::environment::VariableType::Secret
        );
        let mut final_val = var.value.clone();
        let mut is_locked = false;

        // Check if value is encrypted
        if is_secret && crypto::is_encrypted(&var.value) {
            if let Some(ref key) = master_key {
                match crypto::decrypt_secret(&var.value, key, &salt) {
                    Ok(decrypted) => {
                        final_val = decrypted;
                        is_locked = false;
                    }
                    Err(e) => {
                        tracing::warn!("Failed to decrypt secret '{}': {}", var.name, e);
                        final_val = String::new();
                        is_locked = true;
                    }
                }
            } else {
                final_val = String::new();
                is_locked = true;
            }
        } else if is_secret
            && (var.value == format!("{{{{{}}}}}", var.name) || var.value.is_empty())
        {
            // Check if legacy .env has the value for migration
            if let Some(legacy_val) = legacy_map.get(&var.name) {
                final_val = legacy_val.clone();
            }
        } else if !is_secret
            && (var.value == format!("{{{{{}}}}}", var.name) || var.value.is_empty())
        {
            // Check if legacy .env has the value for non-secret migration
            if let Some(legacy_val) = legacy_map.get(&var.name) {
                final_val = legacy_val.clone();
            }
        }

        variables.push(EnvVariableItem {
            key: var.name,
            value: final_val,
            var_type: if is_secret {
                "secret".to_string()
            } else {
                "default".to_string()
            },
            enabled: var.enabled,
            is_locked,
        });
    }

    Ok(EnvironmentDetails {
        name: env.name,
        variables,
    })
}

/// Tauri command to create a new environment.
#[tauri::command]
pub async fn create_environment(
    name: String,
    state: State<'_, AppState>,
) -> Result<EnvironmentDetails, AppError> {
    tracing::info!("Creating environment: '{}'", name);
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let env_dir = ws_state.path.join("environments");
    if !env_dir.exists() {
        std::fs::create_dir_all(&env_dir)?;
    }

    let sanitized = sanitize_name(&name);
    let env_file = env_dir.join(format!("{}.yml", sanitized));
    if env_file.exists() {
        return Err(AppError::DuplicateItem(name));
    }

    let env = crate::models::environment::Environment::new(&name);
    crate::engine::yaml_parser::atomic_write_yaml(&env_file, &env)?;

    tracing::info!("Created environment '{}' successfully", name);

    Ok(EnvironmentDetails {
        name,
        variables: Vec::new(),
    })
}

/// Tauri command to write environment variable updates directly to the YAML file,
/// encrypting any secret variables with the Master Key.
#[tauri::command]
pub async fn update_environment(
    name: String,
    variables: Vec<EnvVariableItem>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    tracing::info!(
        "Updating environment: '{}' ({} variables)",
        name,
        variables.len()
    );
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let env_dir = ws_state.path.join("environments");
    if !env_dir.exists() {
        std::fs::create_dir_all(&env_dir)?;
    }

    let env_file = find_environment_file(&ws_state.path, &name).unwrap_or_else(|| {
        let sanitized = sanitize_name(&name);
        env_dir.join(format!("{}.yml", sanitized))
    });

    let existing_env: Option<crate::models::environment::Environment> = if env_file.exists() {
        crate::engine::yaml_parser::read_and_validate_yaml(&env_file).ok()
    } else {
        None
    };

    // Existing map of encrypted values to preserve locked values if not edited
    let mut existing_val_map = HashMap::new();
    if let Some(ref prev) = existing_env {
        for v in &prev.variables {
            existing_val_map.insert(v.name.clone(), v.value.clone());
        }
    }

    let master_key = key_manager::get_master_key(&ws_state.path);
    let salt = ws_state.path.to_string_lossy().as_bytes().to_vec();

    let mut updated_variables = Vec::new();
    for v in variables {
        let key = v.key.trim().to_string();
        if key.is_empty() {
            continue;
        }

        let is_secret = v.var_type.eq_ignore_ascii_case("secret");
        let final_value = if is_secret {
            if v.is_locked {
                // If it was locked and user did not unlock/edit it, preserve the previous encrypted ciphertext
                existing_val_map
                    .get(&key)
                    .cloned()
                    .unwrap_or_else(|| v.value.clone())
            } else if v.value.trim().is_empty() {
                // Empty secret
                String::new()
            } else {
                // User provided / edited secret plaintext -> must encrypt with Master Key!
                let key_str = master_key.as_ref().ok_or(AppError::MasterKeyRequired)?;
                crypto::encrypt_secret(&v.value, key_str, &salt)?
            }
        } else {
            v.value
        };

        updated_variables.push(crate::models::environment::Variable {
            name: key,
            value: final_value,
            var_type: if is_secret {
                crate::models::environment::VariableType::Secret
            } else {
                crate::models::environment::VariableType::Default
            },
            enabled: v.enabled,
            description: None,
        });
    }

    let mut env =
        existing_env.unwrap_or_else(|| crate::models::environment::Environment::new(&name));
    env.name = name.clone();
    env.variables = updated_variables;
    env.updated_at = Utc::now();

    crate::engine::yaml_parser::atomic_write_yaml(&env_file, &env)?;

    tracing::info!("Environment '{}' updated successfully into YAML", name);

    Ok(())
}

/// Tauri command to delete an environment configuration file.
#[tauri::command]
pub async fn delete_environment(name: String, state: State<'_, AppState>) -> Result<(), AppError> {
    if name.eq_ignore_ascii_case("global") {
        return Err(AppError::PermissionDenied(
            "Global environment cannot be deleted".to_string(),
        ));
    }

    tracing::info!("Deleting environment: '{}'", name);
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let env_file = find_environment_file(&ws_state.path, &name)
        .ok_or_else(|| AppError::ItemNotFound(name.clone()))?;

    std::fs::remove_file(env_file)?;
    tracing::info!("Environment '{}' deleted successfully", name);

    Ok(())
}

/// Tauri command to rename an environment.
#[tauri::command]
pub async fn rename_environment(
    old_name: String,
    new_name: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    if old_name.eq_ignore_ascii_case("global") {
        return Err(AppError::PermissionDenied(
            "Global environment cannot be renamed".to_string(),
        ));
    }

    let sanitized_new = sanitize_name(&new_name);
    if sanitized_new.is_empty() {
        return Err(AppError::SchemaValidationError(
            "Environment name cannot be empty".to_string(),
        ));
    }

    tracing::info!("Renaming environment from '{}' to '{}'", old_name, new_name);
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let old_file = find_environment_file(&ws_state.path, &old_name)
        .ok_or_else(|| AppError::ItemNotFound(old_name.clone()))?;

    let env_dir = ws_state.path.join("environments");
    let new_file = env_dir.join(format!("{}.yml", sanitized_new));

    if new_file.exists() && new_file != old_file {
        return Err(AppError::DuplicateItem(new_name));
    }

    let mut env: crate::models::environment::Environment =
        crate::engine::yaml_parser::read_and_validate_yaml(&old_file)?;
    env.name = new_name.clone();
    env.updated_at = Utc::now();

    crate::engine::yaml_parser::atomic_write_yaml(&new_file, &env)?;

    if new_file != old_file {
        let _ = std::fs::remove_file(&old_file);
    }

    tracing::info!("Environment renamed successfully to '{}'", new_name);

    Ok(())
}
