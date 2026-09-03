use crate::commands::workspace::AppState;
use crate::engine::git_engine::{
    abort_merge, checkout_branch, commit, discard_changes, fetch, get_conflict_file_info,
    get_status, list_branches, pull_rebase, push, resolve_conflict, smart_sync, stage_paths,
    unstage_paths, ConflictFileInfo, GitBranchInfo, GitStatusInfo,
};
use crate::errors::AppError;
use tauri::State;

/// Retrieves detailed Git status for the current active workspace.
#[tauri::command]
pub async fn git_get_status(state: State<'_, AppState>) -> Result<GitStatusInfo, AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;
    get_status(&ws_state.path).await
}

/// Stages specific file paths or all files if list is empty.
#[tauri::command]
pub async fn git_stage_paths(
    paths: Vec<String>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;
    stage_paths(&ws_state.path, &paths).await
}

/// Unstages specific file paths or all staged files.
#[tauri::command]
pub async fn git_unstage_paths(
    paths: Vec<String>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;
    unstage_paths(&ws_state.path, &paths).await
}

/// Discards uncommitted working tree changes for specified paths.
#[tauri::command]
pub async fn git_discard_changes(
    paths: Vec<String>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;
    discard_changes(&ws_state.path, &paths).await
}

/// Commits staged changes with the provided commit message.
#[tauri::command]
pub async fn git_commit(
    message: String,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;
    commit(&ws_state.path, &message).await
}

/// Fetches latest branches/tags from configured remote repository.
#[tauri::command]
pub async fn git_fetch(state: State<'_, AppState>) -> Result<String, AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;
    fetch(&ws_state.path).await
}

/// Runs safe smart sync (auto-stash -> pull --rebase -> stash pop -> push).
#[tauri::command]
pub async fn git_smart_sync(state: State<'_, AppState>) -> Result<String, AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;
    smart_sync(&ws_state.path).await
}

/// Pushes local commits to the upstream branch.
#[tauri::command]
pub async fn git_push(state: State<'_, AppState>) -> Result<String, AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;
    push(&ws_state.path).await
}

/// Pulls from remote using rebase.
#[tauri::command]
pub async fn git_pull_rebase(state: State<'_, AppState>) -> Result<String, AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;
    pull_rebase(&ws_state.path).await
}

/// Lists available local and remote branches.
#[tauri::command]
pub async fn git_list_branches(
    state: State<'_, AppState>,
) -> Result<Vec<GitBranchInfo>, AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;
    list_branches(&ws_state.path).await
}

/// Checks out an existing branch or creates a new one.
#[tauri::command]
pub async fn git_checkout_branch(
    branch: String,
    create: bool,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;
    checkout_branch(&ws_state.path, &branch, create).await
}

/// Loads 3-way conflict details (ours, theirs, base) for a specific conflicted file.
#[tauri::command]
pub async fn git_get_conflict_details(
    path: String,
    state: State<'_, AppState>,
) -> Result<ConflictFileInfo, AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;
    get_conflict_file_info(&ws_state.path, &path).await
}

/// Resolves a file conflict by writing merged content and staging the file.
#[tauri::command]
pub async fn git_resolve_conflict(
    path: String,
    merged_content: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;
    resolve_conflict(&ws_state.path, &path, &merged_content).await
}

/// Aborts an in-progress merge or rebase.
#[tauri::command]
pub async fn git_abort_merge(state: State<'_, AppState>) -> Result<String, AppError> {
    let ws = state.workspace.lock().await;
    let ws_state = ws.as_ref().ok_or(AppError::WorkspaceNotOpened)?;
    abort_merge(&ws_state.path).await
}
