//! Key manager module responsible for storing and retrieving workspace Master Keys
//! strictly in-memory (RAM) during runtime session.

use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex};

/// Global in-memory cache for runtime session master keys.
static SESSION_KEYS: std::sync::OnceLock<Arc<Mutex<HashMap<String, String>>>> =
    std::sync::OnceLock::new();

fn get_session_keys() -> &'static Arc<Mutex<HashMap<String, String>>> {
    SESSION_KEYS.get_or_init(|| Arc::new(Mutex::new(HashMap::new())))
}

/// Normalizes a workspace path to a consistent lookup key.
fn normalize_workspace_key(path: &Path) -> String {
    path.canonicalize()
        .unwrap_or_else(|_| path.to_path_buf())
        .to_string_lossy()
        .to_string()
}

/// Retrieves the Master Key for a workspace, resolving via in-memory Session -> Env Var.
pub fn get_master_key(workspace_path: &Path) -> Option<String> {
    let key_id = normalize_workspace_key(workspace_path);

    // 1. Check in-memory session cache (RAM only)
    if let Ok(session) = get_session_keys().lock() {
        if let Some(key) = session.get(&key_id) {
            if !key.trim().is_empty() {
                return Some(key.clone());
            }
        }
    }

    // 2. Fallback to system environment variable AETHER_MASTER_KEY (e.g. CI/CD or CLI injection)
    if let Ok(env_key) = std::env::var("AETHER_MASTER_KEY") {
        if !env_key.trim().is_empty() {
            return Some(env_key);
        }
    }

    None
}

/// Sets the in-memory Master Key for a workspace in RAM.
pub fn set_master_key(workspace_path: &Path, master_key: &str) {
    let key_id = normalize_workspace_key(workspace_path);
    let trimmed = master_key.trim().to_string();

    if let Ok(mut session) = get_session_keys().lock() {
        session.insert(key_id, trimmed);
    }
}

/// Clears the in-memory Master Key for a workspace from RAM.
pub fn clear_session_key(workspace_path: &Path) {
    let key_id = normalize_workspace_key(workspace_path);
    if let Ok(mut session) = get_session_keys().lock() {
        session.remove(&key_id);
    }
}

/// Removes the Master Key for a workspace from RAM and cleans up any legacy keys.json file.
pub fn delete_master_key(workspace_path: &Path) {
    clear_session_key(workspace_path);

    // Clean up legacy keys.json if it exists from previous versions
    #[cfg(target_os = "windows")]
    let base_dir = std::env::var_os("APPDATA").map(std::path::PathBuf::from);

    #[cfg(not(target_os = "windows"))]
    let base_dir = std::env::var_os("HOME")
        .map(std::path::PathBuf::from)
        .map(|h| h.join(".config"));

    if let Some(path) = base_dir.map(|d| d.join("aether-api").join("keys.json")) {
        if path.exists() {
            let _ = std::fs::remove_file(path);
        }
    }
}
