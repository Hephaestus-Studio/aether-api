use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};

/// Persisted workspace session state across application runs.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceSession {
    /// Workspace root directory path.
    pub workspace_path: PathBuf,
    /// Ordered list of relative or absolute node file paths opened in tabs.
    pub open_node_paths: Vec<String>,
    /// Currently active tab index.
    pub active_tab_index: usize,
    /// Width of the left sidebar in pixels.
    pub sidebar_width: f32,
    /// Whether the left sidebar is currently collapsed.
    pub sidebar_collapsed: bool,
    /// Active sidebar tab ("explorer", "git", "environments").
    pub sidebar_tab: String,
    /// Whether the bottom panel (terminal/environment) is open.
    pub bottom_panel_open: bool,
    /// Height of the bottom panel in pixels.
    pub bottom_panel_height: f32,
}

impl Default for WorkspaceSession {
    fn default() -> Self {
        Self {
            workspace_path: PathBuf::new(),
            open_node_paths: Vec::new(),
            active_tab_index: 0,
            sidebar_width: 260.0,
            sidebar_collapsed: false,
            sidebar_tab: "explorer".to_string(),
            bottom_panel_open: false,
            bottom_panel_height: 220.0,
        }
    }
}

impl WorkspaceSession {
    /// Generates a unique SHA-256 filename for the given workspace path.
    pub fn session_file_path(workspace_root: &Path) -> Option<PathBuf> {
        let canonical = workspace_root
            .canonicalize()
            .unwrap_or_else(|_| workspace_root.to_path_buf());
        let path_str = canonical.to_string_lossy();
        let mut hasher = Sha256::new();
        hasher.update(path_str.as_bytes());
        let hash: String = hasher
            .finalize()
            .iter()
            .map(|b| format!("{:02x}", b))
            .collect();

        dirs::config_dir().map(|p| {
            p.join("aether-api")
                .join("sessions")
                .join(format!("{}.json", hash))
        })
    }

    /// Loads the persisted session for a workspace from disk.
    pub fn load_for_workspace(workspace_root: &Path) -> Option<Self> {
        let file_path = Self::session_file_path(workspace_root)?;
        if !file_path.is_file() {
            return None;
        }

        let content = std::fs::read_to_string(&file_path).ok()?;
        serde_json::from_str(&content).ok()
    }

    /// Saves the session state to disk.
    pub fn save(&self) -> Result<(), std::io::Error> {
        let file_path = match Self::session_file_path(&self.workspace_path) {
            Some(p) => p,
            None => return Ok(()),
        };

        if let Some(parent) = file_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let json = serde_json::to_string_pretty(self)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        std::fs::write(&file_path, json)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_workspace_session_serialization() {
        let session = WorkspaceSession {
            workspace_path: PathBuf::from("/tmp/test-workspace"),
            open_node_paths: vec!["/tmp/test-workspace/req1.yaml".to_string()],
            active_tab_index: 0,
            sidebar_width: 280.0,
            sidebar_collapsed: false,
            sidebar_tab: "git".to_string(),
            bottom_panel_open: true,
            bottom_panel_height: 200.0,
        };

        let json = serde_json::to_string(&session).unwrap();
        let deserialized: WorkspaceSession = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.sidebar_tab, "git");
        assert_eq!(deserialized.sidebar_width, 280.0);
        assert_eq!(deserialized.open_node_paths.len(), 1);
        assert!(deserialized.bottom_panel_open);
    }

    #[test]
    fn test_session_file_path_generation() {
        let p1 = PathBuf::from("/tmp/workspace_a");
        let path1 = WorkspaceSession::session_file_path(&p1);
        assert!(path1.is_some());
        assert!(path1.unwrap().to_string_lossy().ends_with(".json"));
    }
}
