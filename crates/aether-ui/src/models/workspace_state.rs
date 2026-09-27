use crate::models::request_tab_state::RequestTabState;
use aether_core::engine::fs_scanner::{FsScanner, NodeType, WorkspaceTree, WorkspaceTreeNode};
use aether_core::errors::AppError;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

/// Global reactive state for the active workspace.
#[derive(Debug, Clone, Default)]
pub struct WorkspaceState {
    pub workspace_root: Option<PathBuf>,
    pub tree: Option<WorkspaceTree>,
    pub expanded_nodes: HashSet<String>,
    pub selected_node_id: Option<String>,
    pub tabs: Vec<RequestTabState>,
    pub active_tab_index: usize,
}

impl WorkspaceState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Loads a workspace from disk by scanning the target directory.
    pub fn load_workspace(&mut self, path: &Path) -> Result<(), AppError> {
        let tree = FsScanner::scan(path)?;
        self.workspace_root = Some(path.to_path_buf());

        // Auto-expand all top-level collection nodes
        for child in &tree.children {
            if child.node_type == NodeType::Collection {
                self.expanded_nodes.insert(child.id.clone());
            }
        }

        self.tree = Some(tree);
        Ok(())
    }

    /// Reloads the current workspace from disk.
    pub fn reload(&mut self) -> Result<(), AppError> {
        if let Some(root) = self.workspace_root.clone() {
            self.load_workspace(&root)?;
        }
        Ok(())
    }

    /// Toggles the expanded/collapsed state of a directory/collection node.
    pub fn toggle_expanded(&mut self, node_id: &str) {
        if self.expanded_nodes.contains(node_id) {
            self.expanded_nodes.remove(node_id);
        } else {
            self.expanded_nodes.insert(node_id.to_string());
        }
    }

    pub fn is_expanded(&self, node_id: &str) -> bool {
        self.expanded_nodes.contains(node_id)
    }

    /// Opens a request node in a tab or switches to it if already open.
    pub fn open_request(&mut self, node: &WorkspaceTreeNode) {
        self.selected_node_id = Some(node.id.clone());

        // Check if already open in tabs
        if let Some(idx) = self.tabs.iter().position(|t| t.id == node.id) {
            self.active_tab_index = idx;
            return;
        }

        let file_path = PathBuf::from(&node.path);
        if let Ok(tab_state) = RequestTabState::load(&node.id, &file_path) {
            self.tabs.push(tab_state);
            self.active_tab_index = self.tabs.len() - 1;
        }
    }

    /// Closes a tab by index.
    pub fn close_tab(&mut self, index: usize) {
        if index < self.tabs.len() {
            self.tabs.remove(index);
            if self.active_tab_index >= self.tabs.len() && !self.tabs.is_empty() {
                self.active_tab_index = self.tabs.len() - 1;
            }
        }
    }

    /// Selects an active tab by index.
    pub fn select_tab(&mut self, index: usize) {
        if index < self.tabs.len() {
            self.active_tab_index = index;
            if let Some(tab) = self.tabs.get(index) {
                self.selected_node_id = Some(tab.id.clone());
            }
        }
    }

    pub fn active_tab(&self) -> Option<&RequestTabState> {
        self.tabs.get(self.active_tab_index)
    }

    pub fn active_tab_mut(&mut self) -> Option<&mut RequestTabState> {
        self.tabs.get_mut(self.active_tab_index)
    }
}
