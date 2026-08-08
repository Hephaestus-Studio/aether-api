use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Supported HTTP methods for API requests.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "UPPERCASE")]
#[derive(Default)]
pub enum HttpMethod {
    /// GET request method.
    #[default]
    Get,
    /// POST request method.
    Post,
    /// PUT request method.
    Put,
    /// PATCH request method.
    Patch,
    /// DELETE request method.
    Delete,
    /// HEAD request method.
    Head,
    /// OPTIONS request method.
    Options,
}

impl std::fmt::Display for HttpMethod {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            HttpMethod::Get => write!(f, "GET"),
            HttpMethod::Post => write!(f, "POST"),
            HttpMethod::Put => write!(f, "PUT"),
            HttpMethod::Patch => write!(f, "PATCH"),
            HttpMethod::Delete => write!(f, "DELETE"),
            HttpMethod::Head => write!(f, "HEAD"),
            HttpMethod::Options => write!(f, "OPTIONS"),
        }
    }
}

/// A generic key-value pair structure with enabling capability.
///
/// Used for query parameters, headers, variables, etc.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyValuePair {
    /// The key.
    pub key: String,
    /// The value.
    pub value: String,
    /// Whether this key-value pair is active and will be sent in the request.
    pub enabled: bool,
    /// Optional description of what this key-value pair is.
    pub description: Option<String>,
}

impl KeyValuePair {
    /// Creates a new `KeyValuePair` with the key and value, setting `enabled` to `true` by default.
    pub fn new(key: impl Into<String>, value: impl Into<String>) -> Self {
        Self {
            key: key.into(),
            value: value.into(),
            enabled: true,
            description: None,
        }
    }
}

/// Authentication configurations supported by requests.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
#[derive(Default)]
pub enum AuthConfig {
    /// No authentication.
    #[default]
    None,
    /// Bearer Token authentication.
    Bearer { bearer: BearerAuth },
    /// Basic Access authentication.
    Basic { basic: BasicAuth },
    /// Inherit the authentication settings from the parent folder or collection.
    Inherit,
}

/// Bearer authentication configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BearerAuth {
    /// The token value, which supports dynamic variable interpolation (e.g. `{{token}}`).
    pub token: String, // Supports {{variable}} interpolation
}

/// Basic access authentication configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BasicAuth {
    /// Username for basic authentication.
    pub username: String,
    /// Password/token for basic authentication.
    pub password: String,
}

/// Supported body formats for HTTP requests.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum RequestBody {
    /// No body content. Can contain an optional text/string payload.
    None { content: Option<String> },
    /// JSON content body.
    Json { content: String },
    /// XML content body.
    Xml { content: String },
    /// Plain text content body.
    Text { content: String },
    /// YAML content body.
    Yaml { content: String },
    /// URL-encoded form data (`application/x-www-form-urlencoded`).
    FormUrlencoded { content: Vec<KeyValuePair> },
    /// Multipart form data (`multipart/form-data`).
    MultipartForm { content: Vec<MultipartField> },
}

impl Default for RequestBody {
    fn default() -> Self {
        RequestBody::None { content: None }
    }
}

/// Represents an individual field in a multipart form body.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultipartField {
    /// Field key name.
    pub key: String,
    /// Field value (can be plain text or a filepath).
    pub value: String,
    /// Type of the multipart field (text or file).
    #[serde(rename = "type")]
    pub field_type: MultipartFieldType, // "text" | "file"
    /// Whether this multipart field is active.
    pub enabled: bool,
}

/// Supported types for multipart fields.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MultipartFieldType {
    /// A text value field.
    Text,
    /// A file field referencing a local path to upload.
    File,
}

/// Execution settings configured for an API request.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestSettings {
    /// Maximum execution time in milliseconds before timing out.
    pub timeout_ms: u64, // Default: 30000
    /// Whether redirect responses (3xx) should be followed automatically.
    pub follow_redirects: bool, // Default: true
    /// Maximum number of redirect cycles to follow.
    pub max_redirects: u32, // Default: 10
    /// Whether to verify the remote server's SSL certificate validity.
    pub verify_ssl: bool, // Default: true
}

impl Default for RequestSettings {
    fn default() -> Self {
        Self {
            timeout_ms: 30_000,
            follow_redirects: true,
            max_redirects: 10,
            verify_ssl: true,
        }
    }
}

/// Represents a single HTTP Request entity.
///
/// Contains all configuration data necessary to execute an HTTP request,
/// including method, URL, parameters, headers, authentication, body, and options.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    /// Version of the request schema, e.g., "1.0.0".
    pub schema_version: String, // "1.0.0"

    /// The entity type identifier, which is always "request".
    #[serde(rename = "type")]
    pub entity_type: String, // "request"

    /// The name of the request.
    pub name: String,

    /// Optional detailed description of the request.
    pub description: Option<String>,

    /// Fractional Index sequence string used to determine the display order in the UI sidebar.
    pub seq: Option<String>, // Fractional Index for display order

    /// The timestamp when the request was created.
    pub created_at: DateTime<Utc>,

    /// The timestamp when the request was last updated.
    pub updated_at: DateTime<Utc>,

    /// The HTTP method to use (e.g. GET, POST).
    pub method: HttpMethod,

    /// The destination URL, potentially containing `{{variable}}` templates.
    pub url: String, // Raw URL with {{variables}}

    /// Query string parameters to attach to the URL.
    pub params: Vec<KeyValuePair>,

    /// Custom HTTP headers to include with the request.
    pub headers: Vec<KeyValuePair>,

    /// Request-level authentication settings.
    pub auth: AuthConfig,

    /// Request body payload configuration.
    pub body: RequestBody,

    /// Execution settings specific to this request.
    pub settings: RequestSettings,
}

impl Request {
    /// Creates a new `Request` with the given name and default values.
    ///
    /// The schema version defaults to "1.0.0", the entity type to "request",
    /// timestamps are set to the current UTC time, and parameters/headers are empty.
    pub fn new(name: impl Into<String>) -> Self {
        let now = Utc::now();
        Self {
            schema_version: "1.0.0".to_string(),
            entity_type: "request".to_string(),
            name: name.into(),
            description: None,
            seq: None,
            created_at: now,
            updated_at: now,
            method: HttpMethod::default(),
            url: String::new(),
            params: Vec::new(),
            headers: Vec::new(),
            auth: AuthConfig::default(),
            body: RequestBody::default(),
            settings: RequestSettings::default(),
        }
    }
}
