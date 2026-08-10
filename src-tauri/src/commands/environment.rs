use crate::commands::workspace::{sanitize_name, AppState};
use crate::errors::AppError;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;

/// Describes a single environment variable entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvVariableItem {
    /// The variable key/name.
    pub key: String,
    /// The variable value.
    pub value: String,
    /// The format type of the variable: "text" or "secret".
    #[serde(rename = "type")]
    pub var_type: String,
    /// Whether the variable is active.
    pub enabled: bool,
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

/// Tauri command to list all environment summary items in the workspace.
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if no workspace is opened.
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
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if no workspace is opened,
/// or [`AppError::ItemNotFound`] if the environment file does not exist.
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

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

/// Returns the path to the .env file for a specific environment name.
pub fn get_dot_env_path(workspace_path: &Path, env_name: &str) -> PathBuf {
    let sanitized = sanitize_name(env_name);
    if sanitized.is_empty() || sanitized == "default" || sanitized == "global" {
        workspace_path.join(".env")
    } else {
        workspace_path.join(format!(".env.{}", sanitized))
    }
}

/// Ensures that `.gitignore` and `.env.<name>` files exist at the workspace root directory.
/// Appends `.env`, `.env.*`, `*.local` to `.gitignore` if not present.
pub fn ensure_gitignore_and_dotenv(workspace_path: &Path, env_name: &str) -> Result<(), AppError> {
    let dot_env_path = get_dot_env_path(workspace_path, env_name);
    if !dot_env_path.exists() {
        let header = format!(
            "# Local secret environment variables for '{}' (DO NOT COMMIT TO GIT)\n",
            env_name
        );
        std::fs::write(&dot_env_path, header)?;
    }

    let gitignore_path = workspace_path.join(".gitignore");
    if !gitignore_path.exists() {
        let content = "# Local environment variables\n.env\n.env.*\n*.local\n";
        std::fs::write(&gitignore_path, content)?;
    } else if let Ok(content) = std::fs::read_to_string(&gitignore_path) {
        let has_dotenv = content
            .lines()
            .any(|line| line.trim() == ".env" || line.trim() == ".env*");
        if !has_dotenv {
            let mut new_content = content;
            if !new_content.ends_with('\n') {
                new_content.push('\n');
            }
            new_content.push_str("\n# Local environment variables\n.env\n.env.*\n*.local\n");
            std::fs::write(&gitignore_path, new_content)?;
        }
    }

    // Clean up redundant .env.global if present
    let redundant_global = workspace_path.join(".env.global");
    if redundant_global.exists() {
        let _ = std::fs::remove_file(&redundant_global);
    }

    Ok(())
}

/// Reads key-value pairs from global `.env` merged with specific `.env.<env_name>`.
pub fn read_dot_env(workspace_path: &Path, env_name: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();

    // Read global .env first
    let global_env = workspace_path.join(".env");
    if global_env.exists() {
        if let Ok(content) = std::fs::read_to_string(&global_env) {
            parse_env_content(&content, &mut map);
        }
    }

    // Read environment specific .env.<env_name>
    let env_path = get_dot_env_path(workspace_path, env_name);
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

/// Updates / merges key-value pairs into the specific `.env.<env_name>` file while preserving comments.
pub fn update_dot_env(
    workspace_path: &Path,
    env_name: &str,
    updates: &HashMap<String, String>,
) -> Result<(), AppError> {
    let dot_env_path = get_dot_env_path(workspace_path, env_name);
    let mut lines: Vec<String> = Vec::new();
    let mut updated_keys = HashSet::new();

    if dot_env_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&dot_env_path) {
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() || trimmed.starts_with('#') {
                    lines.push(line.to_string());
                    continue;
                }
                if let Some((k, _)) = trimmed.split_once('=') {
                    let key = k.trim();
                    if let Some(new_val) = updates.get(key) {
                        lines.push(format!("{}={}", key, new_val));
                        updated_keys.insert(key.to_string());
                        continue;
                    }
                }
                lines.push(line.to_string());
            }
        }
    }

    for (key, val) in updates {
        if !key.trim().is_empty() && !updated_keys.contains(key) {
            lines.push(format!("{}={}", key, val));
        }
    }

    let mut new_content = lines.join("\n");
    if !new_content.ends_with('\n') {
        new_content.push('\n');
    }

    std::fs::write(&dot_env_path, new_content)?;
    Ok(())
}

/// Tauri command to read and validate a specific environment config by name.
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if no workspace is opened,
/// or [`AppError::ItemNotFound`] if the environment file does not exist.
#[tauri::command]
pub async fn read_environment(
    name: String,
    state: State<'_, AppState>,
) -> Result<EnvironmentDetails, AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let _ = ensure_gitignore_and_dotenv(&ws_state.path, &name);

    if name == "global" || name == "Global" {
        let dot_env_map = read_dot_env(&ws_state.path, "global");
        let variables = dot_env_map
            .into_iter()
            .map(|(k, v)| EnvVariableItem {
                key: k,
                value: v,
                var_type: "text".to_string(),
                enabled: true,
            })
            .collect();

        return Ok(EnvironmentDetails {
            name: "global".to_string(),
            variables,
        });
    }

    let env_file = find_environment_file(&ws_state.path, &name)
        .ok_or_else(|| AppError::ItemNotFound(name.clone()))?;

    let env: crate::models::environment::Environment =
        crate::engine::yaml_parser::read_and_validate_yaml(&env_file)?;

    let dot_env_map = read_dot_env(&ws_state.path, &name);

    let variables = env
        .variables
        .into_iter()
        .map(|v| {
            let real_val = if let Some(dot_val) = dot_env_map.get(&v.name) {
                dot_val.clone()
            } else if v.value == format!("{{{{{}}}}}", v.name) {
                String::new()
            } else {
                v.value
            };

            EnvVariableItem {
                key: v.name,
                value: real_val,
                var_type: match v.var_type {
                    crate::models::environment::VariableType::Secret => "secret".to_string(),
                    crate::models::environment::VariableType::Default => "text".to_string(),
                },
                enabled: v.enabled,
            }
        })
        .collect();

    Ok(EnvironmentDetails {
        name: env.name,
        variables,
    })
}

/// Tauri command to create a new environment configuration file inside the environments directory.
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if no workspace is opened,
/// or [`AppError::DuplicateItem`] if the environment already exists.
#[tauri::command]
pub async fn create_environment(
    name: String,
    state: State<'_, AppState>,
) -> Result<EnvironmentDetails, AppError> {
    tracing::info!("Creating environment: '{}'", name);
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let env_dir = ws_state.path.join("environments");
    let env_file = env_dir.join(format!("{}.yml", sanitize_name(&name)));

    if env_file.exists() {
        tracing::warn!(
            "Environment '{}' already exists at {}",
            name,
            env_file.display()
        );
        return Err(AppError::DuplicateItem(format!(
            "Environment '{}' already exists",
            name
        )));
    }

    let _ = ensure_gitignore_and_dotenv(&ws_state.path, &name);

    let env = crate::models::environment::Environment::new(&name);
    crate::engine::yaml_parser::atomic_write_yaml(&env_file, &env)?;

    tracing::info!("Created environment '{}' successfully", name);

    Ok(EnvironmentDetails {
        name,
        variables: Vec::new(),
    })
}

/// Tauri command to write environment variable updates to disk.
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if no workspace is opened,
/// or [`AppError::ItemNotFound`] if the target environment file does not exist.
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

    let _ = ensure_gitignore_and_dotenv(&ws_state.path, &name);

    if name == "global" || name == "Global" {
        let mut dot_env_updates = HashMap::new();
        for v in &variables {
            if !v.key.trim().is_empty() {
                dot_env_updates.insert(v.key.trim().to_string(), v.value.clone());
            }
        }
        update_dot_env(&ws_state.path, "global", &dot_env_updates)?;
        tracing::info!("Global root .env updated successfully");
        return Ok(());
    }

    let env_file = find_environment_file(&ws_state.path, &name)
        .ok_or_else(|| AppError::ItemNotFound(name.clone()))?;

    let mut env: crate::models::environment::Environment =
        crate::engine::yaml_parser::read_and_validate_yaml(&env_file)?;

    // Store actual secret/concrete values into workspace root .env.<name> file
    let mut dot_env_updates = HashMap::new();
    for v in &variables {
        if !v.key.trim().is_empty() {
            dot_env_updates.insert(v.key.trim().to_string(), v.value.clone());
        }
    }
    update_dot_env(&ws_state.path, &name, &dot_env_updates)?;

    // Write safe placeholder schema "{{key}}" into the environment YAML file
    env.variables = variables
        .into_iter()
        .filter(|v| !v.key.trim().is_empty())
        .map(|v| {
            let key = v.key.trim().to_string();
            crate::models::environment::Variable {
                name: key.clone(),
                value: format!("{{{{{}}}}}", key),
                var_type: if v.var_type == "secret" {
                    crate::models::environment::VariableType::Secret
                } else {
                    crate::models::environment::VariableType::Default
                },
                enabled: v.enabled,
                description: None,
            }
        })
        .collect();

    env.updated_at = Utc::now();
    crate::engine::yaml_parser::atomic_write_yaml(&env_file, &env)?;

    tracing::info!(
        "Environment '{}' updated successfully (values saved to .env.{}, schema placeholders saved to YAML)",
        name,
        sanitize_name(&name)
    );

    Ok(())
}

/// Tauri command to delete an environment configuration file.
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if no workspace is opened,
/// or [`AppError::ItemNotFound`] if target environment does not exist.
#[tauri::command]
pub async fn delete_environment(name: String, state: State<'_, AppState>) -> Result<(), AppError> {
    if name.eq_ignore_ascii_case("global") {
        return Err(AppError::SchemaValidationError(
            "Cannot delete global environment".to_string(),
        ));
    }

    tracing::warn!("Deleting environment: '{}'", name);
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let env_file = find_environment_file(&ws_state.path, &name)
        .ok_or_else(|| AppError::ItemNotFound(name.clone()))?;

    std::fs::remove_file(&env_file)?;

    // Delete corresponding .env.<name> file if exists
    let dot_env_file = get_dot_env_path(&ws_state.path, &name);
    if dot_env_file.exists() && dot_env_file != ws_state.path.join(".env") {
        let _ = std::fs::remove_file(&dot_env_file);
    }

    tracing::info!("Environment '{}' deleted successfully", name);
    Ok(())
}

/// Tauri command to rename an existing environment configuration file.
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if no workspace is opened,
/// [`AppError::ItemNotFound`] if old environment does not exist,
/// or [`AppError::DuplicateItem`] if new environment name already exists.
#[tauri::command]
pub async fn rename_environment(
    old_name: String,
    new_name: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    if old_name.eq_ignore_ascii_case("global") {
        return Err(AppError::SchemaValidationError(
            "Cannot rename global environment".to_string(),
        ));
    }

    let trimmed_new = new_name.trim();
    tracing::info!("Renaming environment: '{}' -> '{}'", old_name, trimmed_new);

    if trimmed_new.is_empty() {
        return Err(AppError::SchemaValidationError(
            "New name cannot be empty".to_string(),
        ));
    }

    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let old_file = find_environment_file(&ws_state.path, &old_name)
        .ok_or_else(|| AppError::ItemNotFound(old_name.clone()))?;

    let env_dir = ws_state.path.join("environments");
    let s_new = sanitize_name(trimmed_new);
    let new_file = env_dir.join(format!("{}.yml", s_new));

    if new_file.exists() && old_file != new_file {
        return Err(AppError::DuplicateItem(format!(
            "Environment '{}' already exists",
            trimmed_new
        )));
    }

    let mut env: crate::models::environment::Environment =
        crate::engine::yaml_parser::read_and_validate_yaml(&old_file)?;

    env.name = trimmed_new.to_string();
    env.updated_at = Utc::now();

    crate::engine::yaml_parser::atomic_write_yaml(&new_file, &env)?;

    if old_file != new_file {
        let _ = std::fs::remove_file(&old_file);
    }

    // Also rename corresponding .env.<old_name> -> .env.<new_name>
    let old_dot_env = get_dot_env_path(&ws_state.path, &old_name);
    let new_dot_env = get_dot_env_path(&ws_state.path, trimmed_new);
    if old_dot_env.exists() && old_dot_env != new_dot_env {
        let _ = std::fs::rename(old_dot_env, new_dot_env);
    }

    tracing::info!(
        "Environment renamed from '{}' to '{}'",
        old_name,
        trimmed_new
    );
    Ok(())
}
