use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Supported UI color themes.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
#[derive(Default)]
pub enum Theme {
    /// Dark theme mode.
    #[default]
    Dark,
    /// Light theme mode.
    Light,
}

/// A reference to an open editor tab in the UI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TabReference {
    /// Relative path of the tab item from the workspace root.
    pub path: String, // Relative path from workspace root
}

/// Configuration settings for the Workspace.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceSettings {
    /// The ID/name of the default active environment.
    pub default_environment: Option<String>,
    /// Selected UI theme color.
    pub theme: Theme, // "dark" | "light"
    /// The width of the sidebar panel in pixels.
    pub sidebar_width: u32, // default: 250
    /// The ratio at which the screen split is divided (e.g. 0.5 for equal split).
    pub split_ratio: f64, // default: 0.5
}

impl Default for WorkspaceSettings {
    fn default() -> Self {
        Self {
            default_environment: None,
            theme: Theme::default(),
            sidebar_width: 250,
            split_ratio: 0.5,
        }
    }
}

/// Represents a Workspace entity.
///
/// A workspace acts as the root boundary for collections, environments, and folders.
/// It persists user settings, layout options, and session state (like open tabs).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    /// Version of the workspace schema, e.g., "1.0.0".
    pub schema_version: String, // "1.0.0"

    /// The entity type identifier, which is always "workspace".
    #[serde(rename = "type")]
    pub entity_type: String, // "workspace"

    /// The name of the workspace.
    pub name: String,

    /// Optional detailed description of the workspace.
    pub description: Option<String>,

    /// Optional semantic version of the user project workspace.
    pub version: Option<String>,

    /// The timestamp when the workspace was created.
    pub created_at: DateTime<Utc>,

    /// The timestamp when the workspace was last updated.
    pub updated_at: DateTime<Utc>,

    /// UI and editor layout configurations of the workspace.
    pub settings: WorkspaceSettings,

    /// List of tab references currently open in the editor.
    pub active_tabs: Vec<TabReference>,

    /// Index of the currently active/focused tab in `active_tabs`.
    pub active_tab_index: usize,
}

impl Workspace {
    /// Creates a new `Workspace` with the given name and default settings.
    ///
    /// The schema version defaults to "1.0.0", the entity type to "workspace",
    /// and the timestamps are set to the current UTC time.
    pub fn new(name: impl Into<String>) -> Self {
        let now = Utc::now();
        Self {
            schema_version: "1.0.0".to_string(),
            entity_type: "workspace".to_string(),
            name: name.into(),
            description: None,
            version: Some("1.0.0".to_string()),
            created_at: now,
            updated_at: now,
            settings: WorkspaceSettings::default(),
            active_tabs: Vec::new(),
            active_tab_index: 0,
        }
    }
}
