//! Context Menu State for Right-Click Menus.
//!
//! Holds absolute popup coordinates, active menu items, target payload
//! (Tree Node, Tab Index, etc.), and open/close state.

use aether_core::engine::fs_scanner::WorkspaceTreeNode;
use gpui::{Pixels, Point};

/// Context menu target descriptor.
#[derive(Debug, Clone)]
pub enum ContextMenuTarget {
    TreeNode(WorkspaceTreeNode),
    Tab(usize),
}

/// An individual item or separator inside the Context Menu.
#[derive(Debug, Clone)]
pub struct ContextMenuItem {
    pub id: String,
    pub label: String,
    pub icon: Option<String>,
    pub shortcut: Option<String>,
    pub is_separator: bool,
    pub is_destructive: bool,
    pub is_disabled: bool,
}

impl ContextMenuItem {
    pub fn action(
        id: impl Into<String>,
        label: impl Into<String>,
        icon: Option<&str>,
        shortcut: Option<&str>,
    ) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            icon: icon.map(|s| s.to_string()),
            shortcut: shortcut.map(|s| s.to_string()),
            is_separator: false,
            is_destructive: false,
            is_disabled: false,
        }
    }

    pub fn destructive(
        id: impl Into<String>,
        label: impl Into<String>,
        icon: Option<&str>,
    ) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            icon: icon.map(|s| s.to_string()),
            shortcut: None,
            is_separator: false,
            is_destructive: true,
            is_disabled: false,
        }
    }

    pub fn separator() -> Self {
        Self {
            id: String::new(),
            label: String::new(),
            icon: None,
            shortcut: None,
            is_separator: true,
            is_destructive: false,
            is_disabled: false,
        }
    }
}

/// State of the active context menu.
#[derive(Debug, Clone, Default)]
pub struct ContextMenuState {
    pub is_open: bool,
    pub position: Point<Pixels>,
    pub items: Vec<ContextMenuItem>,
    pub target: Option<ContextMenuTarget>,
}

impl ContextMenuState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Opens context menu for a Tree Node.
    pub fn open_for_tree_node(&mut self, node: WorkspaceTreeNode, position: Point<Pixels>) {
        use aether_core::engine::fs_scanner::NodeType;
        let mut items = Vec::new();

        match node.node_type {
            NodeType::Collection | NodeType::Folder => {
                items.push(ContextMenuItem::action(
                    "folder_settings",
                    "Folder Settings & Docs",
                    Some("⚙"),
                    None,
                ));
                items.push(ContextMenuItem::action(
                    "new_request",
                    "New Request",
                    Some("✚"),
                    Some("Ctrl+N"),
                ));
                items.push(ContextMenuItem::action(
                    "new_folder",
                    "New Folder",
                    Some("📁"),
                    None,
                ));
                items.push(ContextMenuItem::separator());
                items.push(ContextMenuItem::action(
                    "expand_all",
                    "Expand All",
                    Some("⌄"),
                    None,
                ));
                items.push(ContextMenuItem::action(
                    "collapse_all",
                    "Collapse All",
                    Some("›"),
                    None,
                ));
                items.push(ContextMenuItem::separator());
                items.push(ContextMenuItem::action(
                    "copy_path",
                    "Copy Path",
                    Some("📋"),
                    None,
                ));
                items.push(ContextMenuItem::destructive("delete", "Delete", Some("🗑")));
            }
            NodeType::Request => {
                items.push(ContextMenuItem::action(
                    "open",
                    "Open in New Tab",
                    Some("↗"),
                    None,
                ));
                items.push(ContextMenuItem::action(
                    "duplicate",
                    "Duplicate",
                    Some("⧉"),
                    Some("Ctrl+D"),
                ));
                items.push(ContextMenuItem::action(
                    "copy_curl",
                    "Copy as cURL",
                    Some("⚡"),
                    None,
                ));
                items.push(ContextMenuItem::separator());
                items.push(ContextMenuItem::action(
                    "copy_path",
                    "Copy Path",
                    Some("📋"),
                    None,
                ));
                items.push(ContextMenuItem::destructive("delete", "Delete", Some("🗑")));
            }
            _ => {
                items.push(ContextMenuItem::action(
                    "copy_path",
                    "Copy Path",
                    Some("📋"),
                    None,
                ));
                items.push(ContextMenuItem::destructive("delete", "Delete", Some("🗑")));
            }
        }

        self.is_open = true;
        self.position = position;
        self.items = items;
        self.target = Some(ContextMenuTarget::TreeNode(node));
    }

    /// Opens context menu for an open Tab.
    pub fn open_for_tab(&mut self, tab_index: usize, position: Point<Pixels>) {
        let items = vec![
            ContextMenuItem::action("close_tab", "Close", Some("✕"), Some("Ctrl+W")),
            ContextMenuItem::action("close_other_tabs", "Close Others", None, None),
            ContextMenuItem::action("close_all_tabs", "Close All", None, None),
            ContextMenuItem::separator(),
            ContextMenuItem::action("duplicate_tab", "Duplicate Tab", Some("⧉"), None),
            ContextMenuItem::action("copy_tab_path", "Copy File Path", Some("📋"), None),
        ];

        self.is_open = true;
        self.position = position;
        self.items = items;
        self.target = Some(ContextMenuTarget::Tab(tab_index));
    }

    /// Closes the active context menu.
    pub fn close(&mut self) {
        self.is_open = false;
        self.items.clear();
        self.target = None;
    }
}
