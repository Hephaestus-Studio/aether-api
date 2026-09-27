//! Application-level configuration persistence.
//!
//! Stored in `~/.config/aether-api/config.json` across sessions.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AppConfig {
    #[serde(default = "default_theme")]
    pub theme: String,

    #[serde(default = "default_font_size")]
    pub font_size: f32,

    #[serde(default = "default_ui_font_size")]
    pub ui_font_size: f32,

    #[serde(default = "default_timeout")]
    pub timeout_secs: u64,

    #[serde(default = "default_true")]
    pub follow_redirects: bool,

    #[serde(default = "default_true")]
    pub validate_ssl: bool,

    #[serde(default)]
    pub proxy_url: Option<String>,

    #[serde(default)]
    pub default_workspace_dir: Option<String>,
}

fn default_theme() -> String {
    "dark".to_string()
}

fn default_font_size() -> f32 {
    13.0
}

fn default_ui_font_size() -> f32 {
    12.0
}

fn default_timeout() -> u64 {
    30
}

fn default_true() -> bool {
    true
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            font_size: default_font_size(),
            ui_font_size: default_ui_font_size(),
            timeout_secs: default_timeout(),
            follow_redirects: true,
            validate_ssl: true,
            proxy_url: None,
            default_workspace_dir: None,
        }
    }
}

impl AppConfig {
    /// Returns path to the global config file `~/.config/aether-api/config.json`.
    pub fn config_path() -> PathBuf {
        let base = dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("aether-api");
        base.join("config.json")
    }

    /// Loads application config from disk or returns default.
    pub fn load() -> Self {
        let path = Self::config_path();
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(cfg) = serde_json::from_str::<Self>(&content) {
                    return cfg;
                }
            }
        }
        Self::default()
    }

    /// Saves configuration to disk.
    pub fn save(&self) -> Result<(), String> {
        let path = Self::config_path();
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let json = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;
        fs::write(&path, json).map_err(|e| format!("Failed to write config: {}", e))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let cfg = AppConfig::default();
        assert_eq!(cfg.theme, "dark");
        assert_eq!(cfg.font_size, 13.0);
        assert!(cfg.follow_redirects);
        assert!(cfg.validate_ssl);
    }

    #[test]
    fn test_serialization() {
        let cfg = AppConfig::default();
        let serialized = serde_json::to_string(&cfg).unwrap();
        let deserialized: AppConfig = serde_json::from_str(&serialized).unwrap();
        assert_eq!(cfg, deserialized);
    }
}
