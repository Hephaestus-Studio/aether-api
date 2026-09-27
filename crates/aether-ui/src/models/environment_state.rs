//! Reactive State and Persistence for Environments and Secrets.
//!
//! Handles multi-environment management (Global, Dev, Staging, Prod, Custom),
//! variable resolution (`{{variable_name}}`), dirty state tracking, and
//! AES-256-GCM secret encryption / decryption via master key.

use aether_core::engine::crypto;
use aether_core::engine::yaml_parser;
use aether_core::errors::AppError;
use aether_core::models::environment::{Environment, Variable, VariableType};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// Wrapper holding an Environment along with its file path and UI dirty state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentEntry {
    pub path: PathBuf,
    pub environment: Environment,
    #[serde(skip)]
    pub is_dirty: bool,
    /// In-memory unmasked plaintext values for secret editing while vault is unlocked
    #[serde(skip)]
    pub secret_plaintexts: HashMap<usize, String>,
}

impl EnvironmentEntry {
    pub fn new(path: PathBuf, environment: Environment) -> Self {
        Self {
            path,
            environment,
            is_dirty: false,
            secret_plaintexts: HashMap::new(),
        }
    }
}

/// Reactive State for Environments management in UI.
#[derive(Debug, Clone, Default)]
pub struct EnvironmentState {
    pub entries: Vec<EnvironmentEntry>,
    /// Index of active environment used for request execution (None = No Environment)
    pub active_env_index: Option<usize>,
    /// Index of currently selected environment in the Environment editor panel
    pub selected_env_index: usize,
    /// Search query for filtering variable keys/values
    pub search_query: String,
    /// Master key modal state
    pub is_manage_key_modal_open: bool,
    /// Unsaved changes prompt for switching env
    pub show_unsaved_dialog: bool,
}

impl EnvironmentState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Loads all environments from the workspace directory.
    pub fn load_from_workspace(&mut self, workspace_root: &Path) -> Result<(), AppError> {
        let env_dir = workspace_root.join("environments");
        let mut loaded = Vec::new();

        if env_dir.exists() && env_dir.is_dir() {
            if let Ok(read_dir) = std::fs::read_dir(&env_dir) {
                for entry in read_dir.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        if let Some(ext) = path.extension() {
                            if ext == "yaml" || ext == "yml" {
                                if let Ok(env) =
                                    yaml_parser::read_and_validate_yaml::<Environment>(&path)
                                {
                                    if env.entity_type == "environment" {
                                        loaded.push(EnvironmentEntry::new(path, env));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Also check workspace root for standalone environment yaml files
        if let Ok(read_dir) = std::fs::read_dir(workspace_root) {
            for entry in read_dir.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        if name.ends_with(".env.yaml") || name.ends_with(".env.yml") {
                            if let Ok(env) =
                                yaml_parser::read_and_validate_yaml::<Environment>(&path)
                            {
                                if env.entity_type == "environment"
                                    && !loaded.iter().any(|e| e.path == path)
                                {
                                    loaded.push(EnvironmentEntry::new(path, env));
                                }
                            }
                        }
                    }
                }
            }
        }

        // If no environments exist, seed standard Global & Development environments
        if loaded.is_empty() {
            let _ = std::fs::create_dir_all(&env_dir);

            let global_path = env_dir.join("global.env.yaml");
            let mut global_env = Environment::new("Global");
            global_env.description =
                Some("Global variables accessible across all environments".to_string());
            let _ = yaml_parser::atomic_write_yaml(&global_path, &global_env);
            loaded.push(EnvironmentEntry::new(global_path, global_env));

            let dev_path = env_dir.join("development.env.yaml");
            let mut dev_env = Environment::new("Development");
            dev_env.description = Some("Local development environment".to_string());
            dev_env.variables.push(Variable {
                name: "base_url".to_string(),
                value: "http://localhost:3000".to_string(),
                var_type: VariableType::Default,
                enabled: true,
                description: Some("Local API server URL".to_string()),
            });
            let _ = yaml_parser::atomic_write_yaml(&dev_path, &dev_env);
            loaded.push(EnvironmentEntry::new(dev_path, dev_env));
        }

        self.entries = loaded;
        if self.selected_env_index >= self.entries.len() {
            self.selected_env_index = 0;
        }
        if self.active_env_index.is_none() && !self.entries.is_empty() {
            // Default active environment to the second one (e.g. Development) or Global
            self.active_env_index = Some(if self.entries.len() > 1 { 1 } else { 0 });
        }

        Ok(())
    }

    /// Returns the currently selected environment entry for editing.
    pub fn selected_entry(&self) -> Option<&EnvironmentEntry> {
        self.entries.get(self.selected_env_index)
    }

    /// Returns the currently selected environment entry for mutable editing.
    pub fn selected_entry_mut(&mut self) -> Option<&mut EnvironmentEntry> {
        self.entries.get_mut(self.selected_env_index)
    }

    /// Returns active environment name (or "No Environment").
    pub fn active_env_name(&self) -> String {
        match self.active_env_index {
            Some(idx) => self
                .entries
                .get(idx)
                .map(|e| e.environment.name.clone())
                .unwrap_or_else(|| "No Environment".to_string()),
            None => "No Environment".to_string(),
        }
    }

    /// Builds a combined map of variables for active request resolution.
    /// Merges Global environment (if present) + Active environment (overriding globals).
    pub fn resolve_variables_map(
        &self,
        master_key_base64: Option<&str>,
        workspace_salt: Option<&str>,
    ) -> HashMap<String, Variable> {
        let mut map: HashMap<String, Variable> = HashMap::new();

        let process_entry =
            |entry: &EnvironmentEntry, target_map: &mut HashMap<String, Variable>| {
                for var in &entry.environment.variables {
                    if var.enabled {
                        let mut resolved_var = var.clone();
                        if resolved_var.var_type == VariableType::Secret
                            && resolved_var.value.starts_with("enc:aes-gcm:")
                        {
                            if let Some(key) = master_key_base64 {
                                if let Ok((decrypted, _)) = crypto::decrypt_secret_auto(
                                    &resolved_var.value,
                                    key,
                                    workspace_salt,
                                ) {
                                    resolved_var.value = decrypted;
                                } else {
                                    resolved_var.value =
                                        format!("[ENCRYPTED_SECRET_FAILED:{}]", var.name);
                                }
                            } else {
                                resolved_var.value =
                                    format!("[ENCRYPTED_SECRET_LOCKED:{}]", var.name);
                            }
                        }
                        target_map.insert(var.name.clone(), resolved_var);
                    }
                }
            };

        // 1. Global environment (if exists and is not the active env)
        if let Some(global_entry) = self
            .entries
            .iter()
            .find(|e| e.environment.name.eq_ignore_ascii_case("global"))
        {
            process_entry(global_entry, &mut map);
        }

        // 2. Active environment variables (override globals)
        if let Some(active_idx) = self.active_env_index {
            if let Some(active_entry) = self.entries.get(active_idx) {
                process_entry(active_entry, &mut map);
            }
        }

        map
    }

    /// Adds a new variable row to the currently selected environment.
    pub fn add_variable(&mut self, name: &str, value: &str, var_type: VariableType) {
        if let Some(entry) = self.selected_entry_mut() {
            entry.environment.variables.push(Variable {
                name: name.to_string(),
                value: value.to_string(),
                var_type,
                enabled: true,
                description: None,
            });
            entry.environment.updated_at = Utc::now();
            entry.is_dirty = true;
        }
    }

    /// Removes a variable by index from currently selected environment.
    pub fn remove_variable(&mut self, index: usize) {
        if let Some(entry) = self.selected_entry_mut() {
            if index < entry.environment.variables.len() {
                entry.environment.variables.remove(index);
                entry.secret_plaintexts.remove(&index);
                entry.environment.updated_at = Utc::now();
                entry.is_dirty = true;
            }
        }
    }

    /// Creates a new custom environment file on disk and adds it to the list.
    pub fn create_environment(
        &mut self,
        name: &str,
        workspace_root: &Path,
    ) -> Result<usize, AppError> {
        let env_dir = workspace_root.join("environments");
        let _ = std::fs::create_dir_all(&env_dir);

        let slug = name.to_lowercase().replace(' ', "-");
        let path = env_dir.join(format!("{}.env.yaml", slug));

        let env = Environment::new(name);
        yaml_parser::atomic_write_yaml(&path, &env)?;

        self.entries.push(EnvironmentEntry::new(path, env));
        let new_idx = self.entries.len() - 1;
        self.selected_env_index = new_idx;
        Ok(new_idx)
    }

    /// Deletes the environment at the given index.
    pub fn delete_environment(&mut self, index: usize) -> Result<(), AppError> {
        if index < self.entries.len() {
            let entry = self.entries.remove(index);
            if entry.path.exists() {
                let _ = std::fs::remove_file(&entry.path);
            }

            if self.selected_env_index >= self.entries.len() && !self.entries.is_empty() {
                self.selected_env_index = self.entries.len() - 1;
            }
            if self.active_env_index == Some(index) {
                self.active_env_index = if self.entries.is_empty() {
                    None
                } else {
                    Some(0)
                };
            } else if let Some(active) = self.active_env_index {
                if active > index {
                    self.active_env_index = Some(active - 1);
                }
            }
        }
        Ok(())
    }

    /// Saves the selected environment to disk, encrypting secrets if master key is available.
    pub fn save_selected(
        &mut self,
        master_key_base64: Option<&str>,
        workspace_salt: Option<&str>,
    ) -> Result<(), AppError> {
        if let Some(entry) = self.selected_entry_mut() {
            entry.environment.updated_at = Utc::now();

            let salt_bytes = workspace_salt
                .map(|s| crypto::decode_salt(s))
                .unwrap_or_else(|| b"aether-api-default-salt-v1".to_vec());

            // Encrypt any plaintext secrets before saving
            if let Some(key) = master_key_base64 {
                for (idx, var) in entry.environment.variables.iter_mut().enumerate() {
                    if var.var_type == VariableType::Secret {
                        if let Some(plain) = entry.secret_plaintexts.get(&idx) {
                            if !plain.is_empty() && !plain.starts_with("enc:aes-gcm:") {
                                if let Ok(encrypted) =
                                    crypto::encrypt_secret(plain, key, &salt_bytes)
                                {
                                    var.value = encrypted;
                                }
                            }
                        } else if !var.value.starts_with("enc:aes-gcm:") && !var.value.is_empty() {
                            if let Ok(encrypted) =
                                crypto::encrypt_secret(&var.value, key, &salt_bytes)
                            {
                                var.value = encrypted;
                            }
                        }
                    }
                }
            }

            yaml_parser::atomic_write_yaml(&entry.path, &entry.environment)?;
            entry.is_dirty = false;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;
    use tempfile::tempdir;

    #[test]
    fn test_environment_state_seeding_and_load() {
        let dir = tempdir().unwrap();
        let mut state = EnvironmentState::new();
        state.load_from_workspace(dir.path()).unwrap();

        assert_eq!(state.entries.len(), 2);
        assert_eq!(state.entries[0].environment.name, "Global");
        assert_eq!(state.entries[1].environment.name, "Development");
        assert_eq!(state.active_env_name(), "Development");
    }

    #[test]
    fn test_resolve_variables_global_and_active_override() {
        let mut state = EnvironmentState::new();
        let mut global_env = Environment::new("Global");
        global_env.variables.push(Variable {
            name: "api_host".to_string(),
            value: "https://global.example.com".to_string(),
            var_type: VariableType::Default,
            enabled: true,
            description: None,
        });
        global_env.variables.push(Variable {
            name: "port".to_string(),
            value: "8080".to_string(),
            var_type: VariableType::Default,
            enabled: true,
            description: None,
        });

        let mut prod_env = Environment::new("Production");
        prod_env.variables.push(Variable {
            name: "api_host".to_string(),
            value: "https://api.production.com".to_string(),
            var_type: VariableType::Default,
            enabled: true,
            description: None,
        });

        state.entries.push(EnvironmentEntry::new(
            PathBuf::from("/global.yaml"),
            global_env,
        ));
        state
            .entries
            .push(EnvironmentEntry::new(PathBuf::from("/prod.yaml"), prod_env));
        state.active_env_index = Some(1); // Set Production as active

        let vars = state.resolve_variables_map(None, None);
        assert_eq!(vars.get("port").unwrap().value, "8080");
        // Active environment should override Global
        assert_eq!(
            vars.get("api_host").unwrap().value,
            "https://api.production.com"
        );
    }

    #[test]
    fn test_secret_variable_encryption_and_decryption() {
        let master_key = "my-secret-master-passphrase";
        let key_bytes = crypto::derive_key(master_key, &[]).unwrap();
        let key_b64 = base64::engine::general_purpose::STANDARD.encode(key_bytes);

        let mut state = EnvironmentState::new();
        let mut dev_env = Environment::new("Development");
        dev_env.variables.push(Variable {
            name: "secret_api_key".to_string(),
            value: "super_secret_token_12345".to_string(),
            var_type: VariableType::Secret,
            enabled: true,
            description: None,
        });

        let dir = tempdir().unwrap();
        let env_path = dir.path().join("dev.env.yaml");
        state.entries.push(EnvironmentEntry::new(env_path, dev_env));
        state.selected_env_index = 0;
        state.active_env_index = Some(0);

        // Save with encryption
        state.save_selected(Some(&key_b64), None).unwrap();

        let saved_var = &state.entries[0].environment.variables[0];
        assert!(saved_var.value.starts_with("enc:aes-gcm:"));

        // Resolve with master key should decrypt back to plaintext
        let resolved = state.resolve_variables_map(Some(&key_b64), None);
        assert_eq!(
            resolved.get("secret_api_key").unwrap().value,
            "super_secret_token_12345"
        );
    }
}
