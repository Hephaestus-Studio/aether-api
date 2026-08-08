use crate::errors::AppError;
use serde::de::DeserializeOwned;
use std::io::Write;
use std::path::Path;

const VALID_ENTITY_TYPES: &[&str] = &[
    "workspace",
    "environment",
    "collection",
    "folder",
    "request",
];

/// Reads, parses, and validates a YAML file against schema expectations.
///
/// Ensures the parsed object contains a valid `type` and an expected `schema_version`
/// matching `1.x.x` versions, then deserializes it to `T`.
///
/// # Errors
/// Returns [`AppError::Io`] on read failures, [`AppError::YamlParseError`] on syntax issues,
/// and [`AppError::SchemaValidationError`] on invalid schema fields.
pub fn read_and_validate_yaml<T>(path: &Path) -> Result<T, AppError>
where
    T: DeserializeOwned,
{
    let raw_content = std::fs::read_to_string(path).map_err(AppError::Io)?;

    let val: serde_json::Value = serde_yml::from_str(&raw_content).map_err(|e| {
        AppError::YamlParseError(format!("Failed to parse '{}': {}", path.display(), e))
    })?;

    match val.get("type") {
        Some(entity_type) => {
            let type_str = entity_type.as_str().unwrap_or("");
            if !VALID_ENTITY_TYPES.contains(&type_str) {
                return Err(AppError::SchemaValidationError(format!(
                    "Invalid entity type '{}' in '{}'. Expected one of: {:?}",
                    type_str,
                    path.display(),
                    VALID_ENTITY_TYPES
                )));
            }
        }
        None => {
            return Err(AppError::SchemaValidationError(format!(
                "Missing required 'type' field in '{}'",
                path.display()
            )));
        }
    }

    let schema_version = val.get("schema_version").or_else(|| val.get("schemaVersion"));
    match schema_version {
        Some(version) => {
            let ver_str = version.as_str().unwrap_or("");
            if !ver_str.starts_with("1.") {
                return Err(AppError::SchemaValidationError(format!(
                    "Unsupported schema_version '{}' in '{}'. Expected '1.x.x'",
                    ver_str,
                    path.display()
                )));
            }
        }
        None => {
            return Err(AppError::SchemaValidationError(format!(
                "Missing required 'schema_version' field in '{}'",
                path.display()
            )));
        }
    }

    let target: T = serde_json::from_value(val).map_err(|e| {
        AppError::SchemaValidationError(format!("Schema mismatch in '{}': {}", path.display(), e))
    })?;

    Ok(target)
}

/// Serializes and writes data to a YAML file atomically using a temporary file.
///
/// If write completes successfully, the temp file is persisted over the target path,
/// preventing partial file corruption.
///
/// # Errors
/// Returns [`AppError`] on filesystem permission errors, parsing failures, or persist errors.
pub fn atomic_write_yaml<T>(path: &Path, data: &T) -> Result<(), AppError>
where
    T: serde::Serialize,
{
    let parent = path.parent().ok_or_else(|| AppError::InvalidPath)?;

    if !parent.exists() {
        std::fs::create_dir_all(parent)?;
    }

    let mut temp_file = tempfile::NamedTempFile::new_in(parent).map_err(|e| {
        AppError::FsError(format!(
            "Failed to create temp file in '{}': {}",
            parent.display(),
            e
        ))
    })?;

    let yaml_string = serde_yml::to_string(data)
        .map_err(|e| AppError::YamlParseError(format!("Failed to serialize to YAML: {}", e)))?;

    temp_file.write_all(yaml_string.as_bytes())?;

    temp_file.as_file().sync_all()?;

    temp_file.persist(path).map_err(|e| {
        AppError::FsError(format!(
            "Failed to persist temp file to '{}': {}",
            path.display(),
            e
        ))
    })?;

    Ok(())
}

/// Peeks only the 'type' field of a YAML file.
///
/// Helps quickly identify the category of a document without fully parsing it.
pub fn peek_entity_type(path: &Path) -> Result<String, AppError> {
    let raw = std::fs::read_to_string(path)?;
    let val: serde_json::Value =
        serde_yml::from_str(&raw).map_err(|e| AppError::YamlParseError(e.to_string()))?;

    val.get("type")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| {
            AppError::SchemaValidationError(format!("Missing 'type' field in '{}'", path.display()))
        })
}

/// Peeks standard tree metadata fields ('name', 'seq', 'method') from a YAML file.
pub fn peek_metadata(path: &Path) -> Result<(String, Option<String>, Option<String>), AppError> {
    let raw = std::fs::read_to_string(path)?;
    let val: serde_json::Value =
        serde_yml::from_str(&raw).map_err(|e| AppError::YamlParseError(e.to_string()))?;

    let name = val
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Untitled")
        .to_string();

    let seq = val
        .get("seq")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let method = val
        .get("method")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    Ok((name, seq, method))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::environment::Environment;
    use tempfile::tempdir;

    #[test]
    fn test_atomic_write_and_read_roundtrip() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test_env.yml");

        let env = Environment::new("Test Environment");
        atomic_write_yaml(&file_path, &env).unwrap();

        assert!(file_path.exists());

        let loaded: Environment = read_and_validate_yaml(&file_path).unwrap();
        assert_eq!(loaded.name, "Test Environment");
        assert_eq!(loaded.entity_type, "environment");
        assert_eq!(loaded.schema_version, "1.0.0");
    }

    #[test]
    fn test_missing_type_field_returns_error() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("bad.yml");
        std::fs::write(&file_path, "name: test\nschema_version: \"1.0.0\"").unwrap();

        let result: Result<Environment, _> = read_and_validate_yaml(&file_path);
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_schema_version_returns_error() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("bad_version.yml");
        std::fs::write(
            &file_path,
            "type: environment\nschema_version: \"2.0.0\"\nname: test",
        )
        .unwrap();

        let result: Result<Environment, _> = read_and_validate_yaml(&file_path);
        assert!(result.is_err());
    }
}
