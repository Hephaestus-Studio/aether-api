use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Represents a previously opened workspace item for quick access in the Launcher.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RecentWorkspace {
    /// Display name of the workspace folder/collection.
    pub name: String,
    /// Absolute filesystem path to the workspace directory.
    pub path: PathBuf,
    /// Timestamp when this workspace was last opened.
    pub last_opened: DateTime<Utc>,
}

/// Collection of recent workspaces persisted to disk.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RecentWorkspacesList {
    /// Ordered list of recent workspaces, most recent first.
    pub workspaces: Vec<RecentWorkspace>,
}

impl RecentWorkspacesList {
    /// Returns the standard path to the recent workspaces JSON file.
    pub fn config_file_path() -> Option<PathBuf> {
        dirs::config_dir().map(|p| p.join("aether-api").join("recent_workspaces.json"))
    }

    /// Loads the recent workspaces list from disk, or returns default if not found.
    pub fn load() -> Self {
        let path = match Self::config_file_path() {
            Some(p) => p,
            None => return Self::default(),
        };

        if !path.exists() {
            return Self::default();
        }

        match std::fs::read_to_string(&path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => Self::default(),
        }
    }

    /// Persists the recent workspaces list to disk atomically.
    pub fn save(&self) -> Result<(), std::io::Error> {
        let path = match Self::config_file_path() {
            Some(p) => p,
            None => return Ok(()),
        };

        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let content = serde_json::to_string_pretty(self)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        std::fs::write(&path, content)
    }

    /// Records or updates an opened workspace, moving it to the top of the list.
    pub fn add_or_update(&mut self, path: &Path, name_override: Option<&str>) {
        let path_buf = path.to_path_buf();
        let name = name_override.map(|s| s.to_string()).unwrap_or_else(|| {
            path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "Workspace".to_string())
        });

        // Remove existing item with same path if present
        self.workspaces.retain(|w| w.path != path_buf);

        // Insert at the beginning (MRU order)
        self.workspaces.insert(
            0,
            RecentWorkspace {
                name,
                path: path_buf,
                last_opened: Utc::now(),
            },
        );

        // Keep maximum of 50 recent items
        if self.workspaces.len() > 50 {
            self.workspaces.truncate(50);
        }

        let _ = self.save();
    }

    /// Removes a workspace from the recent list.
    pub fn remove(&mut self, path: &Path) {
        self.workspaces.retain(|w| w.path != path);
        let _ = self.save();
    }
}
