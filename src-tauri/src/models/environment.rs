use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use zeroize::{Zeroize, ZeroizeOnDrop};

/// A wrapper around a secret string that zeroizes memory on drop to prevent exposure.
///
/// It also serializes as a masked string (`"********"`) to prevent accidental leaks.
#[derive(Debug, Clone, Zeroize, ZeroizeOnDrop)]
pub struct SecretValue {
    /// The actual secret content.
    pub inner: String,
}

impl SecretValue {
    /// Creates a new `SecretValue` wrapping the provided string.
    pub fn new(value: impl Into<String>) -> Self {
        Self {
            inner: value.into(),
        }
    }

    /// Exposes the inner secret string slice.
    pub fn expose(&self) -> &str {
        &self.inner
    }
}

impl Serialize for SecretValue {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str("********")
    }
}

impl<'de> Deserialize<'de> for SecretValue {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        Ok(SecretValue::new(s))
    }
}

/// The classification of an environment variable, either default or secret.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum VariableType {
    /// A standard variable stored in plain text.
    Default,
    /// A sensitive variable containing secrets (e.g. passwords, API keys) which should be masked.
    Secret,
}

/// Represents an individual key-value variable in an environment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Variable {
    /// The unique key name of the variable.
    pub name: String,

    /// The value of the variable.
    pub value: String,

    /// The type of variable (default vs. secret).
    #[serde(rename = "type")]
    pub var_type: VariableType, // "default" | "secret"

    /// Flag indicating whether the variable is currently active.
    pub enabled: bool,

    /// An optional description of what the variable is used for.
    pub description: Option<String>,
}

/// Represents an Environment configuration, containing a set of variables.
///
/// Environments are used to parameterize requests, allowing dynamic switching
/// of variable values (e.g. between development, staging, and production environments).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Environment {
    /// Version of the environment schema, e.g., "1.0.0".
    pub schema_version: String, // "1.0.0"

    /// The entity type identifier, which is always "environment".
    #[serde(rename = "type")]
    pub entity_type: String, // "environment"

    /// The display name of the environment.
    pub name: String,

    /// Optional detailed description of the environment.
    pub description: Option<String>,

    /// The timestamp when the environment was created.
    pub created_at: DateTime<Utc>,

    /// The timestamp when the environment was last updated.
    pub updated_at: DateTime<Utc>,

    /// List of key-value variables configured in this environment.
    pub variables: Vec<Variable>,
}

impl Environment {
    /// Creates a new `Environment` with the given name and default values.
    ///
    /// The schema version defaults to "1.0.0", the entity type to "environment",
    /// and the list of variables starts empty.
    pub fn new(name: impl Into<String>) -> Self {
        let now = Utc::now();
        Self {
            schema_version: "1.0.0".to_string(),
            entity_type: "environment".to_string(),
            name: name.into(),
            description: None,
            created_at: now,
            updated_at: now,
            variables: Vec::new(),
        }
    }
}
