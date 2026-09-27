use crate::models::request_tab_state::RequestTabState;
use aether_core::engine::fs_scanner::{FsScanner, NodeType, WorkspaceTree, WorkspaceTreeNode};
use aether_core::errors::AppError;
use aether_core::models::workspace_session::WorkspaceSession;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum SidebarTab {
    #[default]
    Explorer,
    Git,
    Environments,
}

/// Global reactive state for the active workspace.
#[derive(Debug, Clone)]
pub struct WorkspaceState {
    pub workspace_root: Option<PathBuf>,
    pub workspace_salt: Option<String>,
    pub tree: Option<WorkspaceTree>,
    pub expanded_nodes: HashSet<String>,
    pub selected_node_id: Option<String>,
    pub tabs: Vec<RequestTabState>,
    pub active_tab_index: usize,
    pub sidebar_tab: SidebarTab,
    pub sidebar_collapsed: bool,
    pub sidebar_width: f32,
}

impl Default for WorkspaceState {
    fn default() -> Self {
        Self {
            workspace_root: None,
            workspace_salt: None,
            tree: None,
            expanded_nodes: HashSet::new(),
            selected_node_id: None,
            tabs: Vec::new(),
            active_tab_index: 0,
            sidebar_tab: SidebarTab::Explorer,
            sidebar_collapsed: false,
            sidebar_width: 260.0,
        }
    }
}

impl WorkspaceState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn toggle_sidebar_tab(&mut self, tab: SidebarTab) {
        if self.sidebar_tab == tab {
            self.sidebar_collapsed = !self.sidebar_collapsed;
        } else {
            self.sidebar_tab = tab;
            self.sidebar_collapsed = false;
        }
    }

    /// Loads a workspace from disk by scanning the target directory.
    pub fn load_workspace(&mut self, path: &Path) -> Result<(), AppError> {
        let tree = FsScanner::scan(path)?;
        self.workspace_root = Some(path.to_path_buf());

        // Extract workspace salt from workspace.yaml if present
        let ws_yaml = path.join("workspace.yaml");
        if ws_yaml.is_file() {
            if let Ok(ws) = aether_core::engine::yaml_parser::read_and_validate_yaml::<
                aether_core::models::workspace::Workspace,
            >(&ws_yaml)
            {
                self.workspace_salt = ws.salt;
            }
        }

        // Auto-expand all top-level collection nodes
        for child in &tree.children {
            if child.node_type == NodeType::Collection {
                self.expanded_nodes.insert(child.id.clone());
            }
        }

        self.tree = Some(tree);
        self.restore_session();
        Ok(())
    }

    /// Saves the current workspace UI session (open tabs, widths, sidebar state) to disk.
    pub fn save_session(&self) {
        if let Some(root) = &self.workspace_root {
            let open_paths: Vec<String> = self
                .tabs
                .iter()
                .map(|t| t.file_path.to_string_lossy().to_string())
                .collect();

            let session = WorkspaceSession {
                workspace_path: root.clone(),
                open_node_paths: open_paths,
                active_tab_index: self.active_tab_index,
                sidebar_width: self.sidebar_width,
                sidebar_collapsed: self.sidebar_collapsed,
                sidebar_tab: match self.sidebar_tab {
                    SidebarTab::Explorer => "explorer".to_string(),
                    SidebarTab::Git => "git".to_string(),
                    SidebarTab::Environments => "environments".to_string(),
                },
                bottom_panel_open: false,
                bottom_panel_height: 220.0,
            };

            let _ = session.save();
        }
    }

    /// Restores the previously saved session for the active workspace.
    pub fn restore_session(&mut self) {
        if let Some(root) = &self.workspace_root {
            if let Some(session) = WorkspaceSession::load_for_workspace(root) {
                self.sidebar_width = session.sidebar_width;
                self.sidebar_collapsed = session.sidebar_collapsed;
                self.sidebar_tab = match session.sidebar_tab.as_str() {
                    "git" => SidebarTab::Git,
                    "environments" => SidebarTab::Environments,
                    _ => SidebarTab::Explorer,
                };

                for path_str in session.open_node_paths {
                    let file_path = PathBuf::from(&path_str);
                    if file_path.is_file() {
                        let node_id = file_path.to_string_lossy().to_string();
                        if let Ok(tab_state) = RequestTabState::load(&node_id, &file_path) {
                            if !self.tabs.iter().any(|t| t.id == node_id) {
                                self.tabs.push(tab_state);
                            }
                        }
                    }
                }

                if !self.tabs.is_empty() {
                    self.active_tab_index = session.active_tab_index.min(self.tabs.len() - 1);
                }
            }
        }
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
            self.save_session();
            return;
        }

        let file_path = PathBuf::from(&node.path);
        if let Ok(tab_state) = RequestTabState::load(&node.id, &file_path) {
            self.tabs.push(tab_state);
            self.active_tab_index = self.tabs.len() - 1;
            self.save_session();
        }
    }

    /// Closes a tab by index.
    pub fn close_tab(&mut self, index: usize) {
        if index < self.tabs.len() {
            self.tabs.remove(index);
            if self.active_tab_index >= self.tabs.len() && !self.tabs.is_empty() {
                self.active_tab_index = self.tabs.len() - 1;
            }
            self.save_session();
        }
    }

    /// Selects an active tab by index.
    pub fn select_tab(&mut self, index: usize) {
        if index < self.tabs.len() {
            self.active_tab_index = index;
            if let Some(tab) = self.tabs.get(index) {
                self.selected_node_id = Some(tab.id.clone());
            }
            self.save_session();
        }
    }

    pub fn active_tab(&self) -> Option<&RequestTabState> {
        self.tabs.get(self.active_tab_index)
    }

    pub fn active_tab_mut(&mut self) -> Option<&mut RequestTabState> {
        self.tabs.get_mut(self.active_tab_index)
    }
}
