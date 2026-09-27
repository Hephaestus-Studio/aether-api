use super::request::{AuthConfig, KeyValuePair};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Represents a folder within a collection.
///
/// Folders are used to organize API requests hierarchically. They can contain
/// other requests and define folder-level configuration (e.g. inheritance of auth).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Folder {
    /// Version of the folder schema, e.g., "1.0.0".
    pub schema_version: String, // "1.0.0"

    /// The entity type identifier, which is always "folder".
    #[serde(rename = "type")]
    pub entity_type: String, // "folder"

    /// The name of the folder.
    pub name: String,

    /// Optional detailed description of the folder.
    pub description: Option<String>,

    /// Fractional Index sequence string used to determine the display order in the UI sidebar.
    pub seq: Option<String>, // Fractional Index for display order

    /// The timestamp when the folder was created.
    pub created_at: DateTime<Utc>,

    /// The timestamp when the folder was last updated.
    pub updated_at: DateTime<Utc>,

    /// Folder-level authentication configuration. If specified, this is inherited by all requests inside this folder.
    pub auth: Option<AuthConfig>, // Folder-level auth (inherited by children)

    /// Folder-level default headers. If specified, this is inherited/merged into requests inside this folder.
    pub headers: Option<Vec<KeyValuePair>>,
}

impl Folder {
    /// Creates a new `Folder` with the given name and default values.
    ///
    /// The schema version defaults to "1.0.0", the entity type to "folder",
    /// and the timestamps are set to the current UTC time.
    pub fn new(name: impl Into<String>) -> Self {
        let now = Utc::now();
        Self {
            schema_version: "1.0.0".to_string(),
            entity_type: "folder".to_string(),
            name: name.into(),
            description: None,
            seq: None,
            created_at: now,
            updated_at: now,
            auth: None,
            headers: None,
        }
    }
}
