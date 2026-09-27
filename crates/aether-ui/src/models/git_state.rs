use aether_core::engine::git_engine::{
    ConflictFileInfo, GitBranchInfo, GitFileInfo, GitStatusInfo,
};
use std::path::{Path, PathBuf};

/// Model tracking Git repository status, branch lists, staged/unstaged changes,
/// and conflict resolution state for the UI.
#[derive(Debug, Clone)]
pub struct GitState {
    /// Workspace root path on disk.
    pub workspace_path: Option<PathBuf>,
    /// Comprehensive Git status payload.
    pub status: Option<GitStatusInfo>,
    /// Available branches.
    pub branches: Vec<GitBranchInfo>,
    /// Whether the current workspace is a valid Git repository.
    pub is_git_repo: bool,
    /// Indicates whether a status refresh or branch listing is in flight.
    pub is_loading: bool,
    /// Indicates whether a network sync/push/pull/fetch is actively running.
    pub sync_in_progress: bool,
    /// Indicates whether a commit is being executed.
    pub commit_in_progress: bool,
    /// Error message from the last Git operation, if any.
    pub error_message: Option<String>,
    /// Currently active conflict file being resolved in the Conflict Resolver modal.
    pub active_conflict: Option<ConflictFileInfo>,
    /// Whether the branch switcher dropdown is open.
    pub branch_picker_open: bool,
    /// Filter query in the branch switcher.
    pub branch_filter: String,
    /// Whether the Staged Changes section is collapsed.
    pub staged_collapsed: bool,
    /// Whether the Changes section is collapsed.
    pub unstaged_collapsed: bool,
    /// Whether the Merge Conflicts section is collapsed.
    pub conflicts_collapsed: bool,
}

impl Default for GitState {
    fn default() -> Self {
        Self::new()
    }
}

impl GitState {
    pub fn new() -> Self {
        Self {
            workspace_path: None,
            status: None,
            branches: Vec::new(),
            is_git_repo: false,
            is_loading: false,
            sync_in_progress: false,
            commit_in_progress: false,
            error_message: None,
            active_conflict: None,
            branch_picker_open: false,
            branch_filter: String::new(),
            staged_collapsed: false,
            unstaged_collapsed: false,
            conflicts_collapsed: false,
        }
    }

    /// Sets the workspace path and resets status.
    pub fn set_workspace(&mut self, path: &Path) {
        self.workspace_path = Some(path.to_path_buf());
        self.status = None;
        self.branches.clear();
        self.is_git_repo = path.join(".git").exists();
        self.error_message = None;
    }

    /// Updates status payload.
    pub fn update_status(&mut self, status: GitStatusInfo) {
        self.is_git_repo = true;
        self.status = Some(status);
        self.is_loading = false;
        self.error_message = None;
    }

    /// Updates available branch list.
    pub fn update_branches(&mut self, branches: Vec<GitBranchInfo>) {
        self.branches = branches;
    }

    /// Total count of all changed files (staged, unstaged, untracked, conflicted).
    pub fn total_changes_count(&self) -> usize {
        if let Some(status) = &self.status {
            status.staged_files.len()
                + status.unstaged_files.len()
                + status.untracked_files.len()
                + status.conflicted_files.len()
        } else {
            0
        }
    }

    /// Returns list of unstaged files combined with untracked files.
    pub fn all_unstaged_files(&self) -> Vec<GitFileInfo> {
        let mut list = Vec::new();
        if let Some(status) = &self.status {
            list.extend(status.unstaged_files.clone());
            list.extend(status.untracked_files.clone());
        }
        list
    }

    /// Sets active conflict file.
    pub fn set_active_conflict(&mut self, conflict: Option<ConflictFileInfo>) {
        self.active_conflict = conflict;
    }

    /// Toggles branch picker visibility.
    pub fn toggle_branch_picker(&mut self) {
        self.branch_picker_open = !self.branch_picker_open;
        self.branch_filter.clear();
    }

    /// Sets error message.
    pub fn set_error(&mut self, error: String) {
        self.error_message = Some(error);
        self.is_loading = false;
        self.sync_in_progress = false;
        self.commit_in_progress = false;
    }

    /// Clears error message.
    pub fn clear_error(&mut self) {
        self.error_message = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_git_state_initial_and_workspace_setting() {
        let mut state = GitState::new();
        assert!(!state.is_git_repo);
        assert!(state.status.is_none());
        assert_eq!(state.total_changes_count(), 0);

        let temp_dir = tempfile::tempdir().unwrap();
        state.set_workspace(temp_dir.path());
        assert!(!state.is_git_repo);

        std::fs::create_dir(temp_dir.path().join(".git")).unwrap();
        state.set_workspace(temp_dir.path());
        assert!(state.is_git_repo);
    }

    #[test]
    fn test_git_state_update_status_and_changes_count() {
        let mut state = GitState::new();
        let status = GitStatusInfo {
            branch_name: "feature/auth".to_string(),
            upstream_branch: Some("origin/feature/auth".to_string()),
            ahead_count: 2,
            behind_count: 1,
            staged_files: vec![GitFileInfo {
                path: "collections/login.yml".to_string(),
                status: "added".to_string(),
                code: "A.".to_string(),
            }],
            unstaged_files: vec![GitFileInfo {
                path: "collections/users.yml".to_string(),
                status: "modified".to_string(),
                code: ".M".to_string(),
            }],
            untracked_files: vec![GitFileInfo {
                path: "collections/new_req.yml".to_string(),
                status: "untracked".to_string(),
                code: "??".to_string(),
            }],
            conflicted_files: vec![GitFileInfo {
                path: "workspace.yaml".to_string(),
                status: "conflicted".to_string(),
                code: "UU".to_string(),
            }],
            is_clean: false,
            is_merging: false,
            is_rebasing: false,
        };

        state.update_status(status);
        assert_eq!(state.total_changes_count(), 4);
        assert_eq!(state.all_unstaged_files().len(), 2);
    }

    #[test]
    fn test_git_state_conflict_and_branch_picker() {
        let mut state = GitState::new();
        assert!(!state.branch_picker_open);

        state.toggle_branch_picker();
        assert!(state.branch_picker_open);

        state.toggle_branch_picker();
        assert!(!state.branch_picker_open);

        let conflict = ConflictFileInfo {
            path: "test.yml".to_string(),
            raw_content: "<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>>".to_string(),
            ours_content: "ours".to_string(),
            theirs_content: "theirs".to_string(),
            base_content: None,
            is_request_yaml: true,
        };

        state.set_active_conflict(Some(conflict));
        assert!(state.active_conflict.is_some());
        assert_eq!(state.active_conflict.as_ref().unwrap().ours_content, "ours");

        state.set_active_conflict(None);
        assert!(state.active_conflict.is_none());
    }
}
