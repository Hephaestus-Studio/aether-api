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
#[tauri::command]
pub async fn read_environment(
    name: String,
    state: State<'_, AppState>,
) -> Result<EnvironmentDetails, AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let env_file_yml = ws_state
        .path
        .join("environments")
        .join(format!("{}.yml", name));
    let env_file_yaml = ws_state
        .path
        .join("environments")
        .join(format!("{}.yaml", name));

    let env_file = if env_file_yml.exists() {
        env_file_yml
    } else if env_file_yaml.exists() {
        env_file_yaml
    } else {
        return Err(AppError::ItemNotFound(name));
    };

    let env: crate::models::environment::Environment =
        crate::engine::yaml_parser::read_and_validate_yaml(&env_file)?;

    let variables = env
        .variables
        .into_iter()
        .map(|v| EnvVariableItem {
            key: v.name,
            value: v.value,
            var_type: match v.var_type {
                crate::models::environment::VariableType::Secret => "secret".to_string(),
                crate::models::environment::VariableType::Default => "text".to_string(),
            },
            enabled: v.enabled,
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
        tracing::warn!("Environment '{}' already exists at {}", name, env_file.display());
        return Err(AppError::DuplicateItem(format!(
            "Environment '{}' already exists",
            name
        )));
    }

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
    tracing::info!("Updating environment: '{}' ({} variables)", name, variables.len());
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let env_file_yml = ws_state
        .path
        .join("environments")
        .join(format!("{}.yml", name));
    let env_file_yaml = ws_state
        .path
        .join("environments")
        .join(format!("{}.yaml", name));

    let env_file = if env_file_yml.exists() {
        env_file_yml
    } else if env_file_yaml.exists() {
        env_file_yaml
    } else {
        tracing::error!("Environment file not found for update: {}", name);
        return Err(AppError::ItemNotFound(name));
    };

    let mut env: crate::models::environment::Environment =
        crate::engine::yaml_parser::read_and_validate_yaml(&env_file)?;

    env.variables = variables
        .into_iter()
        .map(|v| crate::models::environment::Variable {
            name: v.key,
            value: v.value,
            var_type: if v.var_type == "secret" {
                crate::models::environment::VariableType::Secret
            } else {
                crate::models::environment::VariableType::Default
            },
            enabled: v.enabled,
            description: None,
        })
        .collect();

    env.updated_at = Utc::now();
    crate::engine::yaml_parser::atomic_write_yaml(&env_file, &env)?;

    tracing::info!("Environment '{}' updated successfully", name);

    Ok(())
}

/// Tauri command to delete an environment configuration file.
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if no workspace is opened,
/// or [`AppError::ItemNotFound`] if target environment does not exist.
#[tauri::command]
pub async fn delete_environment(name: String, state: State<'_, AppState>) -> Result<(), AppError> {
    tracing::warn!("Deleting environment: '{}'", name);
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let env_file_yml = ws_state
        .path
        .join("environments")
        .join(format!("{}.yml", name));
    let env_file_yaml = ws_state
        .path
        .join("environments")
        .join(format!("{}.yaml", name));

    let env_file = if env_file_yml.exists() {
        env_file_yml
    } else if env_file_yaml.exists() {
        env_file_yaml
    } else {
        tracing::error!("Environment file not found for deletion: {}", name);
        return Err(AppError::ItemNotFound(name));
    };

    std::fs::remove_file(&env_file)?;
    tracing::info!("Environment '{}' deleted successfully", name);
    Ok(())
}
