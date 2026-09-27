use crate::errors::AppError;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Global application configuration settings persisted under the system's config path.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    /// Selected UI theme color ("dark", "light", or "system").
    pub theme: String,
    /// Default font size for UI/editor elements.
    pub font_size: u32,
    /// Base font size for UI components.
    #[serde(default = "default_ui_font_size")]
    pub ui_font_size: u32,
    /// Default parent directory path used when scaffolding new workspaces.
    pub default_parent_directory: Option<String>,
}

fn default_ui_font_size() -> u32 {
    13
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            font_size: 13,
            ui_font_size: 13,
            default_parent_directory: None,
        }
    }
}

/// Global settings manager handling AppConfig reading and writing.
pub struct ConfigManager;

impl ConfigManager {
    /// Resolves the absolute path to the global settings JSON config file.
    pub fn get_config_path() -> Result<PathBuf, AppError> {
        let config_dir = dirs::config_dir()
            .map(|p| p.join("aether-api"))
            .ok_or_else(|| {
                AppError::FsError("Unable to locate system config directory".to_string())
            })?;

        if !config_dir.exists() {
            std::fs::create_dir_all(&config_dir)?;
        }
        Ok(config_dir.join("config.json"))
    }

    /// Reads global application configuration from file, falling back to defaults if absent.
    pub fn read_config() -> Result<AppConfig, AppError> {
        let path = Self::get_config_path()?;
        if !path.exists() {
            let default_config = AppConfig::default();
            Self::write_config(&default_config)?;
            return Ok(default_config);
        }

        let content = std::fs::read_to_string(&path)?;
        let config: AppConfig =
            serde_json::from_str(&content).unwrap_or_else(|_| AppConfig::default());
        Ok(config)
    }

    /// Persists global configuration changes atomically back to disk.
    pub fn write_config(config: &AppConfig) -> Result<(), AppError> {
        let path = Self::get_config_path()?;
        let content = serde_json::to_string_pretty(config)
            .map_err(|e| AppError::FsError(format!("Failed to serialize app config: {}", e)))?;
        std::fs::write(&path, content)?;
        Ok(())
    }
}
