use super::request::{AuthConfig, KeyValuePair, RequestSettings};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Represents an API Collection in the workspace.
///
/// A collection acts as a container for folders and requests, allowing users
/// to group related API requests together and share configurations like authentication,
/// headers, and request settings.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    /// Version of the collection schema, e.g., "1.0.0".
    pub schema_version: String, // "1.0.0"

    /// The entity type identifier, which is always "collection".
    #[serde(rename = "type")]
    pub entity_type: String, // "collection"

    /// The display name of the collection.
    pub name: String,

    /// Optional detailed description of the collection.
    pub description: Option<String>,

    /// Fractional Index sequence string used to determine the display order in the UI sidebar.
    pub seq: Option<String>, // Fractional Index for display order

    /// The timestamp when the collection was created.
    pub created_at: DateTime<Utc>,

    /// The timestamp when the collection was last updated.
    pub updated_at: DateTime<Utc>,

    /// Collection-level authentication configuration. If specified, this is inherited by all requests in the collection.
    pub auth: Option<AuthConfig>, // Collection-level auth (inherited by children)

    /// Collection-level default request settings.
    pub settings: Option<RequestSettings>, // Collection-level default settings

    /// Collection-level default headers applied to all requests.
    pub headers: Option<Vec<KeyValuePair>>, // Collection-level default headers
}

impl Collection {
    /// Creates a new `Collection` with the given name and default values.
    ///
    /// The schema version defaults to "1.0.0", the entity type to "collection",
    /// and the timestamps are set to the current UTC time.
    pub fn new(name: impl Into<String>) -> Self {
        let now = Utc::now();
        Self {
            schema_version: "1.0.0".to_string(),
            entity_type: "collection".to_string(),
            name: name.into(),
            description: None,
            seq: None,
            created_at: now,
            updated_at: now,
            auth: None,
            settings: None,
            headers: None,
        }
    }
}
