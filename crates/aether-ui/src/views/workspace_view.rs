use crate::components::{
    render_command_palette, render_request_editor, render_sidebar, render_snippet_modal,
    render_tab_bar, render_terminal_panel, render_vault_dialog,
};
use crate::models::{
    PickerItem, PickerState, SnippetModalState, TerminalState, VaultState, WorkspaceState,
};
use crate::theme::Theme;
use aether_core::engine::fs_scanner::{NodeType, WorkspaceTreeNode};
use gpui::prelude::*;
use gpui::*;
use std::path::Path;

/// The main workspace view coordinating Sidebar, TabBar, Request Area, Terminal Panel, Modals and Command Palette.
pub struct WorkspaceView {
    pub state: WorkspaceState,
    pub terminal_state: TerminalState,
    pub picker_state: PickerState,
    pub vault_state: VaultState,
    pub snippet_modal_state: SnippetModalState,
    pub theme: Theme,
    pub focus_handle: FocusHandle,
}

fn check_workspace_has_secrets(path: &Path) -> bool {
    let env_dir = path.join("environments");
    if env_dir.is_dir() {
        if let Ok(entries) = std::fs::read_dir(env_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file()
                    && p.extension().map_or(false, |ext| ext == "yaml" || ext == "yml")
                {
                    if let Ok(content) = std::fs::read_to_string(&p) {
                        if content.contains("enc:aes-gcm:")
                            || content.contains("type: secret")
                            || content.contains("type: \"secret\"")
                            || content.contains("type: 'secret'")
                        {
                            return true;
                        }
                    }
                }
            }
        }
    }
    let ws_yaml = path.join("workspace.yaml");
    if ws_yaml.is_file() {
        if let Ok(content) = std::fs::read_to_string(&ws_yaml) {
            if content.contains("salt:") {
                return true;
            }
        }
    }
    false
}

impl WorkspaceView {
    pub fn new(cx: &mut Context<Self>) -> Self {
        Self {
            state: WorkspaceState::new(),
            terminal_state: TerminalState::new(),
            picker_state: PickerState::new(),
            vault_state: VaultState::new(),
            snippet_modal_state: SnippetModalState::new(),
            theme: Theme::dark(),
            focus_handle: cx.focus_handle(),
        }
    }

    pub fn with_workspace(path: &Path, cx: &mut Context<Self>) -> Self {
        let mut state = WorkspaceState::new();
        let _ = state.load_workspace(path);
        let mut recents = aether_core::models::recent_workspace::RecentWorkspacesList::load();
        recents.add_or_update(path, None);

        let mut vault_state = VaultState::new();
        if check_workspace_has_secrets(path) {
            vault_state.open_dialog();
        }

        Self {
            state,
            terminal_state: TerminalState::new(),
            picker_state: PickerState::new(),
            vault_state,
            snippet_modal_state: SnippetModalState::new(),
            theme: Theme::dark(),
            focus_handle: cx.focus_handle(),
        }
    }

    pub fn handle_key_down(
        &mut self,
        event: &KeyDownEvent,
        _window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let key = event.keystroke.key.as_str();
        let modifiers = &event.keystroke.modifiers;

        // 1. If Vault dialog is open, route keystrokes to master_key_input
        if self.vault_state.is_dialog_open {
            match key {
                "escape" => {
                    self.vault_state.close_dialog();
                    cx.notify();
                }
                "enter" | "return" => {
                    self.unlock_vault(cx);
                }
                "backspace" => {
                    self.vault_state.master_key_input.pop();
                    self.vault_state.error_message = None;
                    cx.notify();
                }
                "space" => {
                    self.vault_state.master_key_input.push(' ');
                    self.vault_state.error_message = None;
                    cx.notify();
                }
                _ => {
                    if modifiers.control && (key == "v" || key == "V") {
                        if let Some(clipboard) = cx.read_from_clipboard() {
                            if let Some(text) = clipboard.text() {
                                self.vault_state.master_key_input.push_str(&text);
                                self.vault_state.error_message = None;
                                cx.notify();
                            }
                        }
                    } else if !modifiers.control && !modifiers.alt && !modifiers.platform && key.chars().count() == 1 {
                        self.vault_state.master_key_input.push_str(key);
                        self.vault_state.error_message = None;
                        cx.notify();
                    }
                }
            }
            return;
        }

        // 2. If Command Palette / Quick Open is open
        if self.picker_state.is_open {
            match key {
                "escape" => {
                    self.picker_state.close();
                    cx.notify();
                }
                "down" | "arrowdown" => {
                    self.picker_state.select_next();
                    cx.notify();
                }
                "up" | "arrowup" => {
                    self.picker_state.select_prev();
                    cx.notify();
                }
                "enter" => {
                    if let Some(item) = self.picker_state.selected_item() {
                        let id = item.id.clone();
                        self.execute_picker_item(&id, cx);
                    }
                }
                "backspace" => {
                    self.picker_state.query.pop();
                    cx.notify();
                }
                _ => {
                    if !modifiers.control && !modifiers.alt && !modifiers.platform && key.chars().count() == 1 {
                        self.picker_state.query.push_str(key);
                        cx.notify();
                    }
                }
            }
            return;
        }

        // 3. Global Shortcuts
        if modifiers.control {
            match key {
                "p" | "P" => {
                    self.open_quick_open(cx);
                }
                "k" | "K" => {
                    self.open_command_palette(cx);
                }
                "s" | "S" => {
                    self.save_active_request(cx);
                }
                "w" | "W" => {
                    if !self.state.tabs.is_empty() {
                        self.close_tab(self.state.active_tab_index, cx);
                    }
                }
                "`" | "~" => {
                    self.toggle_terminal(cx);
                }
                "enter" => {
                    self.send_active_request(cx);
                }
                _ => {}
            }
        }
    }

    pub fn load_workspace(&mut self, path: &Path, cx: &mut Context<Self>) {
        if self.state.load_workspace(path).is_ok() {
            let mut recents = aether_core::models::recent_workspace::RecentWorkspacesList::load();
            recents.add_or_update(path, None);
            if check_workspace_has_secrets(path) && !self.vault_state.is_unlocked {
                self.vault_state.open_dialog();
            }
            cx.notify();
        }
    }

    /// Opens Native OS Folder Picker dialog to choose a collection workspace folder.
    pub fn open_folder_dialog(&mut self, cx: &mut Context<Self>) {
        cx.spawn(|view: WeakEntity<WorkspaceView>, cx: &mut AsyncApp| {
            let cx = cx.clone();
            async move {
                let mut cx = cx;
                if let Some(folder) = rfd::AsyncFileDialog::new().pick_folder().await {
                    let path = folder.path().to_path_buf();
                    let _ = view.update(&mut cx, |this, cx| {
                        this.load_workspace(&path, cx);
                    });
                }
            }
        })
        .detach();
    }

    pub fn reload(&mut self, cx: &mut Context<Self>) {
        if self.state.reload().is_ok() {
            cx.notify();
        }
    }

    pub fn toggle_node(&mut self, node_id: &str, cx: &mut Context<Self>) {
        self.state.toggle_expanded(node_id);
        cx.notify();
    }

    pub fn open_request(&mut self, node: &WorkspaceTreeNode, cx: &mut Context<Self>) {
        self.state.open_request(node);
        cx.notify();
    }

    pub fn select_tab(&mut self, index: usize, cx: &mut Context<Self>) {
        self.state.select_tab(index);
        cx.notify();
    }

    pub fn close_tab(&mut self, index: usize, cx: &mut Context<Self>) {
        self.state.close_tab(index);
        cx.notify();
    }

    pub fn toggle_terminal(&mut self, cx: &mut Context<Self>) {
        if self.terminal_state.tabs.is_empty() {
            self.create_terminal_tab(cx);
        } else {
            self.terminal_state.toggle_visibility();
            cx.notify();
        }
    }

    /// Spawns a new PTY terminal session tab and listens for output chunks asynchronously.
    pub fn create_terminal_tab(&mut self, cx: &mut Context<Self>) {
        let cwd = self.state.workspace_root.clone();
        if let Some(mut rx) = self.terminal_state.create_tab(cwd) {
            let tab_id = self
                .terminal_state
                .active_tab()
                .map(|t| t.id.clone())
                .unwrap_or_default();
            cx.notify();

            cx.spawn(move |view: WeakEntity<WorkspaceView>, cx: &mut AsyncApp| {
                let cx = cx.clone();
                async move {
                    let mut cx = cx;
                    while let Some(bytes) = rx.recv().await {
                        let text = String::from_utf8_lossy(&bytes).to_string();
                        let tab_id_clone = tab_id.clone();
                        let _ = view.update(&mut cx, |this, cx| {
                            this.terminal_state.append_output(&tab_id_clone, &text);
                            cx.notify();
                        });
                    }
                }
            })
            .detach();
        }
    }

    /// Opens Code Snippet Generator modal for current request.
    pub fn open_snippet_modal(&mut self, cx: &mut Context<Self>) {
        if self.state.active_tab().is_some() {
            self.snippet_modal_state.open();
            cx.notify();
        }
    }

    /// Opens Secrets Vault Unlock Dialog.
    pub fn open_vault_dialog(&mut self, cx: &mut Context<Self>) {
        self.vault_state.open_dialog();
        cx.notify();
    }

    /// Unlocks the vault with master key passphrase.
    pub fn unlock_vault(&mut self, cx: &mut Context<Self>) {
        let _ = self.vault_state.unlock(None);
        cx.notify();
    }

    /// Opens Quick Open modal with all requests in the workspace.
    pub fn open_quick_open(&mut self, cx: &mut Context<Self>) {
        let mut items = Vec::new();
        if let Some(tree) = &self.state.tree {
            collect_request_items(&tree.children, &mut items);
        }
        self.picker_state.open_quick_open(items);
        cx.notify();
    }

    /// Opens Command Palette with available actions.
    pub fn open_command_palette(&mut self, cx: &mut Context<Self>) {
        let items = vec![
            PickerItem {
                id: "cmd_open_folder".to_string(),
                title: "Open Workspace Folder...".to_string(),
                subtitle: Some("Choose local collection directory on disk".to_string()),
                badge: None,
                shortcut: Some("Ctrl+O".to_string()),
            },
            PickerItem {
                id: "cmd_reload".to_string(),
                title: "Reload Workspace".to_string(),
                subtitle: Some("Rescan files from disk".to_string()),
                badge: None,
                shortcut: Some("Ctrl+R".to_string()),
            },
            PickerItem {
                id: "cmd_send".to_string(),
                title: "Send Active Request".to_string(),
                subtitle: Some("Execute current HTTP request".to_string()),
                badge: None,
                shortcut: Some("Ctrl+Enter".to_string()),
            },
            PickerItem {
                id: "cmd_save".to_string(),
                title: "Save Active Request".to_string(),
                subtitle: Some("Write changes to YAML file".to_string()),
                badge: None,
                shortcut: Some("Ctrl+S".to_string()),
            },
            PickerItem {
                id: "cmd_snippet".to_string(),
                title: "Generate Code Snippet...".to_string(),
                subtitle: Some("Convert to cURL, Python, JS, Rust, Go, Java".to_string()),
                badge: None,
                shortcut: None,
            },
            PickerItem {
                id: "cmd_vault".to_string(),
                title: "Unlock Secrets Vault...".to_string(),
                subtitle: Some("Decrypt environment secrets (AES-256-GCM)".to_string()),
                badge: None,
                shortcut: None,
            },
            PickerItem {
                id: "cmd_terminal".to_string(),
                title: "Toggle Terminal".to_string(),
                subtitle: Some("Open or close embedded shell".to_string()),
                badge: None,
                shortcut: Some("Ctrl+~".to_string()),
            },
            PickerItem {
                id: "cmd_quick_open".to_string(),
                title: "Quick Open Request...".to_string(),
                subtitle: Some("Search request by name".to_string()),
                badge: None,
                shortcut: Some("Ctrl+P".to_string()),
            },
        ];
        self.picker_state.open_command_palette(items);
        cx.notify();
    }

    /// Executes the selected item from Quick Open or Command Palette.
    pub fn execute_picker_item(&mut self, item_id: &str, cx: &mut Context<Self>) {
        self.picker_state.close();

        if item_id.starts_with("req_") {
            let node_path = &item_id[4..];
            if let Some(node) = find_node_by_path(&self.state.tree, node_path) {
                self.open_request(&node, cx);
            }
        } else {
            match item_id {
                "cmd_open_folder" => self.open_folder_dialog(cx),
                "cmd_reload" => self.reload(cx),
                "cmd_send" => self.send_active_request(cx),
                "cmd_save" => {
                    if let Some(tab) = self.state.active_tab_mut() {
                        let _ = tab.save();
                        cx.notify();
                    }
                }
                "cmd_snippet" => self.open_snippet_modal(cx),
                "cmd_vault" => self.open_vault_dialog(cx),
                "cmd_terminal" => self.toggle_terminal(cx),
                "cmd_quick_open" => self.open_quick_open(cx),
                _ => {}
            }
        }
    }

    /// Sends the currently active HTTP request and updates the tab state with the response.
    pub fn save_active_request(&mut self, cx: &mut Context<Self>) {
        if let Some(tab) = self.state.active_tab_mut() {
            let _ = tab.save();
            cx.notify();
        }
    }

    pub fn send_active_request(&mut self, cx: &mut Context<Self>) {
        let tab_idx = self.state.active_tab_index;
        let tab = match self.state.tabs.get_mut(tab_idx) {
            Some(t) => t,
            None => return,
        };

        if tab.is_sending {
            return;
        }

        tab.is_sending = true;
        tab.error_message = None;
        let tab_clone = tab.clone();
        cx.notify();

        cx.spawn(move |view: WeakEntity<WorkspaceView>, cx: &mut AsyncApp| {
            let cx = cx.clone();
            async move {
                let mut cx = cx;
                let result = tab_clone.execute_request().await;

                let _ = view.update(&mut cx, |this, cx| {
                    if let Some(tab) = this.state.tabs.get_mut(tab_idx) {
                        tab.is_sending = false;
                        match result {
                            Ok(response) => {
                                tab.response = Some(response);
                                tab.error_message = None;
                            }
                            Err(err) => {
                                tab.error_message = Some(err.to_string());
                            }
                        }
                    }
                    cx.notify();
                });
            }
        })
        .detach();
    }
}

fn collect_request_items(nodes: &[WorkspaceTreeNode], items: &mut Vec<PickerItem>) {
    for node in nodes {
        if node.node_type == NodeType::Request {
            items.push(PickerItem {
                id: format!("req_{}", node.path),
                title: node.name.clone(),
                subtitle: Some(node.id.clone()),
                badge: node.method.clone(),
                shortcut: None,
            });
        }
        collect_request_items(&node.children, items);
    }
}

fn find_node_by_path(
    tree: &Option<aether_core::engine::fs_scanner::WorkspaceTree>,
    path: &str,
) -> Option<WorkspaceTreeNode> {
    let tree = tree.as_ref()?;
    fn search(nodes: &[WorkspaceTreeNode], path: &str) -> Option<WorkspaceTreeNode> {
        for n in nodes {
            if n.path == path {
                return Some(n.clone());
            }
            if let Some(found) = search(&n.children, path) {
                return Some(found);
            }
        }
        None
    }
    search(&tree.children, path)
}

impl Render for WorkspaceView {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        if !self.focus_handle.is_focused(window) {
            window.focus(&self.focus_handle);
        }

        let theme = &self.theme;
        let entity = cx.entity().clone();
        let active_tab = self.state.active_tab().cloned();

        div()
            .id("workspace-view-root")
            .track_focus(&self.focus_handle)
            .on_key_down(cx.listener(|this, event: &KeyDownEvent, window, cx| {
                this.handle_key_down(event, window, cx);
            }))
            .flex()
            .size_full()
            .relative()
            .bg(theme.background)
            .text_color(theme.text_primary)
            // Left Sidebar
            .child(render_sidebar(&self.state, theme, entity.clone()))
            // Center Main Area
            .child(
                div()
                    .flex()
                    .flex_col()
                    .flex_1()
                    .h_full()
                    // Top Tab Bar
                    .child(render_tab_bar(&self.state, theme, entity.clone()))
                    // Request & Response Content Area
                    .child(
                        div()
                            .flex()
                            .flex_col()
                            .flex_1()
                            .p_4()
                            .when_some(active_tab, |this, tab| {
                                this.child(render_request_editor(&tab, theme, entity.clone()))
                            })
                            .when(self.state.tabs.is_empty(), |this| {
                                let has_workspace = self.state.tree.is_some();
                                let view_open_folder = entity.clone();
                                let view_quick_open = entity.clone();

                                if !has_workspace {
                                    this.items_center()
                                        .justify_center()
                                        .gap_4()
                                        .child(
                                            div()
                                                .text_lg()
                                                .font_weight(FontWeight::BOLD)
                                                .text_color(theme.text_primary)
                                                .child("Welcome to Aether API"),
                                        )
                                        .child(
                                            div()
                                                .text_xs()
                                                .text_color(theme.text_muted)
                                                .child("Open a workspace folder to explore and test your API collections."),
                                        )
                                        .child(
                                            div()
                                                .id("welcome-open-folder-btn")
                                                .px_4()
                                                .py_2()
                                                .rounded_sm()
                                                .bg(theme.primary)
                                                .text_color(hsla(0.0, 0.0, 1.0, 1.0))
                                                .text_xs()
                                                .font_weight(FontWeight::BOLD)
                                                .cursor_pointer()
                                                .hover(|s| s.bg(theme.primary_hover))
                                                .on_click(move |_, _window, cx| {
                                                    view_open_folder.update(cx, |this, cx| {
                                                        this.open_folder_dialog(cx);
                                                    });
                                                })
                                                .child("Open Workspace Folder... (Ctrl+O)"),
                                        )
                                        .child(
                                            div()
                                                .flex()
                                                .flex_col()
                                                .items_center()
                                                .gap_1()
                                                .pt_3()
                                                .text_size(px(11.0))
                                                .text_color(theme.text_muted)
                                                .child(div().child("Ctrl+O  •  Open Workspace"))
                                                .child(div().child("Ctrl+K  •  Command Palette"))
                                                .child(div().child("Ctrl+~  •  Embedded Terminal")),
                                        )
                                } else {
                                    this.items_center()
                                        .justify_center()
                                        .gap_3()
                                        .child(
                                            div()
                                                .text_base()
                                                .font_weight(FontWeight::BOLD)
                                                .child("No Request Open"),
                                        )
                                        .child(
                                            div()
                                                .text_xs()
                                                .text_color(theme.text_muted)
                                                .child("Select a request from sidebar, or press Quick Open (Ctrl+P)"),
                                        )
                                        .child(
                                            div()
                                                .id("empty-quick-open-btn")
                                                .px_3()
                                                .py_1p5()
                                                .rounded_sm()
                                                .bg(theme.surface_hover)
                                                .text_color(theme.text_primary)
                                                .text_xs()
                                                .cursor_pointer()
                                                .hover(|s| s.bg(theme.border))
                                                .on_click(move |_, _window, cx| {
                                                    view_quick_open.update(cx, |this, cx| {
                                                        this.open_quick_open(cx);
                                                    });
                                                })
                                                .child("Quick Open Request (Ctrl+P)"),
                                        )
                                }
                            }),
                    )
                    // Bottom Embedded Terminal Panel
                    .child(render_terminal_panel(&self.terminal_state, theme, entity.clone())),
            )
            // Command Palette / Quick Open Modal Overlay
            .child(render_command_palette(&self.picker_state, theme, entity.clone()))
            // Code Snippet Generator Modal Overlay
            .child(render_snippet_modal(&self.snippet_modal_state, self.state.active_tab(), theme, entity.clone()))
            // Secrets Vault Unlock Dialog Overlay
            .child(render_vault_dialog(&self.vault_state, theme, entity))
    }
}
