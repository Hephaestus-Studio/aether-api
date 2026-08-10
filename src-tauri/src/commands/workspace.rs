use crate::engine::fs_scanner::{FsScanner, WorkspaceTree};
use crate::errors::AppError;
use crate::watcher::debounce::start_debounce_loop;
use crate::watcher::FsWatcher;
use chrono::Utc;
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::State;
use tokio::sync::mpsc;

/// Represents the active state of an opened workspace.
#[allow(dead_code)]
pub struct WorkspaceState {
    /// Absolute path to the workspace root directory.
    pub path: PathBuf,
    /// Active filesystem watcher monitor.
    pub watcher: FsWatcher,
    /// The scanned workspace file node tree representation.
    pub tree: WorkspaceTree,
}

/// Global shared application state registered inside the Tauri app builder context.
pub struct AppState {
    /// Mutex wrapping the current active workspace state.
    pub workspace: tokio::sync::Mutex<Option<WorkspaceState>>,
    /// Shared HTTP execution agent.
    pub http_executor: crate::engine::http_client::HttpExecutor,
    /// Shared manager for active/running requests cancellation tracking.
    pub request_tracker: crate::engine::http_client::RequestTracker,
    /// Shared manager for active PTY terminal sessions.
    pub terminal_manager: crate::commands::terminal::TerminalManager,
}

impl AppState {
    /// Initializes a new [`AppState`] with a specified HTTP execution agent.
    pub fn new(http_executor: crate::engine::http_client::HttpExecutor) -> Self {
        Self {
            workspace: tokio::sync::Mutex::new(None),
            http_executor,
            request_tracker: crate::engine::http_client::RequestTracker::new(),
            terminal_manager: crate::commands::terminal::TerminalManager::new(),
        }
    }
}

/// Information payload detailing workspace characteristics.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceInfo {
    /// Absolute path to the workspace directory.
    pub path: String,
    /// Display name of the workspace.
    pub name: String,
    /// ISO timestamp when the workspace metadata was created.
    pub created_at: String,
    /// Configuration and preferences settings.
    pub settings: crate::models::workspace::WorkspaceSettings,
}

/// Tauri command that opens a directory path as a workspace.
///
/// Sets up directory watch handles, scaffolds default workspace structures (e.g. `workspace.yml`)
/// if absent, and returns the workspace tree hierarchy.
///
/// # Errors
/// Returns [`AppError::ItemNotFound`] if the path does not exist or is not a directory.
#[tauri::command]
pub async fn open_workspace(
    directory_path: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<WorkspaceTree, AppError> {
    tracing::info!("Opening workspace at path: {}", directory_path);
    let path = PathBuf::from(&directory_path);
    if !path.exists() || !path.is_dir() {
        tracing::error!("Workspace directory not found: {}", directory_path);
        return Err(AppError::ItemNotFound(directory_path));
    }

    let workspace_yml = path.join("workspace.yml");
    if !workspace_yml.exists() {
        tracing::info!("Scaffolding new workspace.yml at {}", path.display());
        create_workspace_scaffold(&path)?;
    } else {
        // Automatically ensure .env and .gitignore exist for existing environments
        let env_dir = path.join("environments");
        if let Ok(entries) = std::fs::read_dir(&env_dir) {
            for entry in entries.flatten() {
                let file_path = entry.path();
                if file_path.is_file() {
                    if let Some(ext) = file_path.extension() {
                        if ext == "yml" || ext == "yaml" {
                            if let Some(stem) = file_path.file_stem().and_then(|s| s.to_str()) {
                                let _ = crate::commands::environment::ensure_gitignore_and_dotenv(
                                    &path, stem,
                                );
                            }
                        }
                    }
                }
            }
        } else {
            let _ = crate::commands::environment::ensure_gitignore_and_dotenv(&path, "dev");
        }
    }

    let tree = FsScanner::scan(&path)?;

    let (tx, rx) = mpsc::channel(100);
    let watcher = FsWatcher::new(path.clone(), tx)?;

    tokio::spawn(start_debounce_loop(rx, app_handle));

    let mut ws = state.workspace.lock().await;
    *ws = Some(WorkspaceState {
        path: path.clone(),
        watcher,
        tree: tree.clone(),
    });

    tracing::info!("Workspace successfully loaded: {}", path.display());

    Ok(tree)
}

/// Tauri command that closes the active workspace.
///
/// Cancels all active requests running in background threads and drops the workspace state lock.
#[tauri::command]
pub async fn close_workspace(state: State<'_, AppState>) -> Result<(), AppError> {
    tracing::info!("Closing active workspace");
    let mut ws = state.workspace.lock().await;
    if ws.is_some() {
        state.request_tracker.cancel_all().await;
        *ws = None;
    }
    Ok(())
}

/// Tauri command that retrieves information on the currently active workspace.
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if no workspace is currently loaded.
#[tauri::command]
pub async fn get_workspace_info(state: State<'_, AppState>) -> Result<WorkspaceInfo, AppError> {
    let ws = state.workspace.lock().await;
    if let Some(ws_state) = &*ws {
        let ws_file = ws_state.path.join("workspace.yml");
        let workspace: crate::models::workspace::Workspace =
            crate::engine::yaml_parser::read_and_validate_yaml(&ws_file)?;

        Ok(WorkspaceInfo {
            path: ws_state.path.to_string_lossy().to_string(),
            name: workspace.name,
            created_at: workspace.created_at.to_rfc3339(),
            settings: workspace.settings,
        })
    } else {
        Err(AppError::WorkspaceNotOpened)
    }
}

/// Inputs for updating the state layout configuration of the workspace.
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveWorkspaceStateInput {
    /// Active open request/collection tabs paths.
    pub open_tabs: Vec<String>,
    /// The unique relative path ID of the currently focused tab.
    pub active_tab_id: Option<String>,
    /// Sidebar panel display width.
    pub sidebar_width: u32,
}

/// Tauri command to persist workspace layout structures, focused tabs, and panel widths.
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if no workspace is currently loaded.
#[tauri::command]
pub async fn save_workspace_state(
    input: SaveWorkspaceStateInput,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let ws = state.workspace.lock().await;
    if let Some(ws_state) = &*ws {
        let ws_file = ws_state.path.join("workspace.yml");
        let mut workspace: crate::models::workspace::Workspace =
            crate::engine::yaml_parser::read_and_validate_yaml(&ws_file)?;

        workspace.active_tabs = input
            .open_tabs
            .into_iter()
            .map(|path| crate::models::workspace::TabReference { path })
            .collect();

        if let Some(active_id) = &input.active_tab_id {
            workspace.active_tab_index = workspace
                .active_tabs
                .iter()
                .position(|t| t.path == *active_id)
                .unwrap_or(0);
        } else {
            workspace.active_tab_index = 0;
        }

        workspace.settings.sidebar_width = input.sidebar_width;
        workspace.updated_at = Utc::now();

        crate::engine::yaml_parser::atomic_write_yaml(&ws_file, &workspace)?;
        Ok(())
    } else {
        Err(AppError::WorkspaceNotOpened)
    }
}

/// Describes git category characteristics for modified files.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitFileStatus {
    /// Relative path of the modified resource.
    pub path: String,
    /// Category of modification: e.g. "modified", "untracked", "added", or "deleted".
    pub status: String,
}

/// Git status payload summary.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusResult {
    /// Active git branch head name.
    pub branch_name: String,
    /// Collection list of changed files.
    pub modified_files: Vec<GitFileStatus>,
}

/// Tauri command to check repository git changes inside the active workspace directory path.
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if workspace is not loaded,
/// or [`AppError::GitNotFound`] if git shell commands are unavailable.
#[tauri::command]
pub async fn get_git_status(state: State<'_, AppState>) -> Result<GitStatusResult, AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let branch_output = tokio::process::Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&ws_state.path)
        .output()
        .await
        .map_err(|_| AppError::GitNotFound)?;

    let branch_name = if branch_output.status.success() {
        String::from_utf8_lossy(&branch_output.stdout)
            .trim()
            .to_string()
    } else {
        "HEAD".to_string()
    };

    let output = tokio::process::Command::new("git")
        .args(["status", "--porcelain", "-uall"])
        .current_dir(&ws_state.path)
        .output()
        .await
        .map_err(|_| AppError::GitNotFound)?;

    if !output.status.success() {
        return Err(AppError::NotAGitRepository);
    }

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let mut modified_files = Vec::new();

    for line in stdout_str.lines() {
        if line.len() < 4 {
            continue;
        }
        let status_code = &line[0..2];
        let file_path = line[3..].trim().to_string();

        let status = match status_code {
            " M" | "M " => "modified",
            "??" => "untracked",
            " A" | "A " => "added",
            " D" | "D " => "deleted",
            _ => "modified",
        };

        modified_files.push(GitFileStatus {
            path: file_path,
            status: status.to_string(),
        });
    }

    Ok(GitStatusResult {
        branch_name,
        modified_files,
    })
}

/// Diff content payload response.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffResult {
    /// Raw git diff patch context.
    pub diff_content: String,
}

/// Tauri command generating unified diff patches for a changed file against HEAD.
///
/// # Errors
/// Returns [`AppError::WorkspaceNotOpened`] if no workspace is opened,
/// or [`AppError::GitNotFound`] if git execution commands are not found.
#[tauri::command]
pub async fn get_git_diff(
    file_path: String,
    state: State<'_, AppState>,
) -> Result<GitDiffResult, AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;

    let output = tokio::process::Command::new("git")
        .args(["diff", "HEAD", &file_path])
        .current_dir(&ws_state.path)
        .output()
        .await
        .map_err(|_| AppError::GitNotFound)?;

    if !output.status.success() {
        return Err(AppError::NotAGitRepository);
    }

    let diff_content = String::from_utf8_lossy(&output.stdout).to_string();

    Ok(GitDiffResult { diff_content })
}

/// Scaffolds and constructs default configurations (workspace.yml, collections, environments) for a new workspace path.
pub fn create_workspace_scaffold(path: &Path) -> Result<(), AppError> {
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("New Workspace")
        .to_string();

    let workspace = crate::models::workspace::Workspace::new(name);
    let ws_file = path.join("workspace.yml");
    crate::engine::yaml_parser::atomic_write_yaml(&ws_file, &workspace)?;

    // Ensure .gitignore and .env.dev exist at workspace root
    let _ = crate::commands::environment::ensure_gitignore_and_dotenv(path, "dev");

    // Initial default .env.dev variable value
    let mut default_dotenv = std::collections::HashMap::new();
    default_dotenv.insert("base_url".to_string(), "http://localhost:8080".to_string());
    let _ = crate::commands::environment::update_dot_env(path, "dev", &default_dotenv);

    // Scaffold dev.yml environment with placeholder
    let env_dir = path.join("environments");
    std::fs::create_dir_all(&env_dir)?;
    let mut dev_env = crate::models::environment::Environment::new("dev");
    dev_env
        .variables
        .push(crate::models::environment::Variable {
            name: "base_url".to_string(),
            value: "{{base_url}}".to_string(),
            var_type: crate::models::environment::VariableType::Default,
            enabled: true,
            description: None,
        });
    crate::engine::yaml_parser::atomic_write_yaml(&env_dir.join("dev.yml"), &dev_env)?;

    let col_dir = path.join("collections");
    std::fs::create_dir_all(&col_dir)?;

    Ok(())
}

/// Scans child contents in a directory to resolve the largest sequence string (used for sequential append placement).
pub fn get_last_seq_in_dir(dir_path: &Path) -> Option<String> {
    let mut seqs = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let meta_yml = path.join("collection.yml");
                if meta_yml.exists() {
                    if let Ok((_, Some(seq), _)) =
                        crate::engine::yaml_parser::peek_metadata(&meta_yml)
                    {
                        seqs.push(seq);
                    }
                } else {
                    let folder_yml = path.join("folder.yml");
                    if folder_yml.exists() {
                        if let Ok((_, Some(seq), _)) =
                            crate::engine::yaml_parser::peek_metadata(&folder_yml)
                        {
                            seqs.push(seq);
                        }
                    }
                }
            } else if path.is_file() {
                if let Ok((_, Some(seq), _)) = crate::engine::yaml_parser::peek_metadata(&path) {
                    seqs.push(seq);
                }
            }
        }
    }
    seqs.sort();
    seqs.pop()
}

/// Sanitizes directory or file name inputs replacing operating system forbidden path characters and spaces with hyphens, converting to lowercase.
pub fn sanitize_name(name: &str) -> String {
    name.trim()
        .to_lowercase()
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | ' ' => '-',
            _ => c,
        })
        .collect()
}


/// Tauri command to explicitly create and scaffold a new workspace.
#[tauri::command]
pub async fn create_workspace(name: String, parent_directory: String) -> Result<String, AppError> {
    let sanitized = sanitize_name(&name);
    let parent_path = PathBuf::from(&parent_directory);
    let workspace_path = parent_path.join(sanitized);

    if workspace_path.exists() {
        return Err(AppError::DuplicateItem(format!(
            "Directory already exists: {}",
            workspace_path.display()
        )));
    }

    std::fs::create_dir_all(&workspace_path)?;
    create_workspace_scaffold(&workspace_path)?;

    Ok(workspace_path.to_string_lossy().to_string())
}

/// Tauri command to fetch the global application settings.
#[tauri::command]
pub fn get_app_config(
    app_handle: tauri::AppHandle,
) -> Result<crate::engine::config::AppConfig, AppError> {
    crate::engine::config::ConfigManager::read_config(&app_handle)
}

/// Tauri command to update the global application settings.
#[tauri::command]
pub fn update_app_config(
    config: crate::engine::config::AppConfig,
    app_handle: tauri::AppHandle,
) -> Result<(), AppError> {
    crate::engine::config::ConfigManager::write_config(&app_handle, &config)
}
