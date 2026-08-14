use serde::Serialize;
use thiserror::Error;

/// Enumeration of all potential application-wide errors.
///
/// Implements `thiserror::Error` for display integration and includes conversions
/// to serializable formats for Inter-Process Communication (IPC) payload transfers.
#[derive(Error, Debug)]
pub enum AppError {
    /// Error triggered by input/output operations (e.g. file system actions).
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    /// Error during parsing of YAML data files.
    #[error("YAML parse error: {0}")]
    YamlParseError(String),

    /// Error indicating schema or version validation constraints were not met.
    #[error("Schema validation failed: {0}")]
    SchemaValidationError(String),

    /// Error caused by network communication failures or server-side problems.
    #[error("Network connection failed: {0}")]
    NetworkError(#[from] reqwest::Error),

    /// Error indicating the request execution was cancelled by the user.
    #[error("Request cancelled by user")]
    RequestCancelled,

    /// Error raised when circular dependency loops are discovered during environment variable substitution.
    #[error("Circular reference detected in environment variables")]
    CircularVariableReference,

    /// Error for invalid path configurations or names.
    #[error("Invalid path format")]
    InvalidPath,

    /// Error representing general file system database or storage issue.
    #[error("File system error: {0}")]
    FsError(String),

    /// Error when a requested resource, directory, or file does not exist.
    #[error("Item not found: {0}")]
    ItemNotFound(String),

    /// Error when trying to create a resource that already exists.
    #[error("Duplicate item: {0}")]
    DuplicateItem(String),

    /// Error signifying operation permission restrictions.
    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    /// Error indicating the file/directory lock could not be acquired.
    #[error("File locked: {0}")]
    FileLocked(String),

    /// Error when executing an operation that requires an active opened workspace.
    #[error("Workspace not opened")]
    WorkspaceNotOpened,

    /// Error indicating Git command line utility is not installed or resolved.
    #[error("Git not found")]
    GitNotFound,

    /// Error showing the workspace target is not a valid Git repository directory.
    #[error("Not a git repository")]
    NotAGitRepository,

    /// Error triggered when a connection or operation exceeds its permitted timeout limit.
    #[error("Timeout error")]
    TimeoutError,

    /// Error related to cryptographic operations (encryption/decryption).
    #[error("Crypto error: {0}")]
    CryptoError(String),

    /// Error indicating a Master Key is required to decrypt/encrypt secrets.
    #[error("Master Key required for this operation")]
    MasterKeyRequired,

    /// Error indicating that an incorrect master key was supplied.
    #[error("Invalid Master Key: {0}")]
    InvalidMasterKey(String),
}

/// Serializable IPC payload used to return errors back to the frontend/UI.
#[derive(Serialize)]
pub struct IpcErrorPayload {
    /// Machine-readable error code string (e.g. `IO_ERROR`).
    pub code: String,
    /// Human-readable error message.
    pub message: String,
}

impl AppError {
    /// Transforms the `AppError` into a serializable `IpcErrorPayload`.
    ///
    /// Maps each error variant to an appropriate uppercase string identifier
    /// code and formats the string representation of the error.
    pub fn to_ipc_payload(&self) -> IpcErrorPayload {
        let code = match self {
            AppError::Io(_) => "IO_ERROR",
            AppError::YamlParseError(_) => "YAML_PARSE_ERROR",
            AppError::SchemaValidationError(_) => "SCHEMA_VALIDATION_ERROR",
            AppError::NetworkError(_) => "NETWORK_ERROR",
            AppError::RequestCancelled => "REQUEST_CANCELLED",
            AppError::CircularVariableReference => "CIRCULAR_VARIABLE",
            AppError::InvalidPath => "INVALID_PATH",
            AppError::FsError(_) => "FS_DATABASE_ERROR",
            AppError::ItemNotFound(_) => "ITEM_NOT_FOUND",
            AppError::DuplicateItem(_) => "DUPLICATE_ITEM",
            AppError::PermissionDenied(_) => "PERMISSION_DENIED",
            AppError::FileLocked(_) => "FILE_LOCKED",
            AppError::WorkspaceNotOpened => "WORKSPACE_NOT_OPENED",
            AppError::GitNotFound => "GIT_NOT_FOUND",
            AppError::NotAGitRepository => "NOT_A_GIT_REPOSITORY",
            AppError::TimeoutError => "TIMEOUT_ERROR",
            AppError::CryptoError(_) => "CRYPTO_ERROR",
            AppError::MasterKeyRequired => "MASTER_KEY_REQUIRED",
            AppError::InvalidMasterKey(_) => "INVALID_MASTER_KEY",
        }
        .to_string();

        IpcErrorPayload {
            code,
            message: self.to_string(),
        }
    }
}

impl From<AppError> for tauri::ipc::InvokeError {
    fn from(err: AppError) -> Self {
        let payload = err.to_ipc_payload();
        tauri::ipc::InvokeError::from(serde_json::to_string(&payload).unwrap())
    }
}
