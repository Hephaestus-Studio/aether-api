use crate::components::{
    render_about_modal, render_activity_bar, render_command_palette, render_conflict_resolver,
    render_context_menu, render_environment_panel, render_folder_editor, render_manage_key_modal,
    render_notifications, render_request_editor, render_settings_modal, render_sidebar,
    render_snippet_modal, render_sse_editor, render_tab_bar, render_terminal_panel,
    render_unsaved_modal, render_vault_dialog, render_websocket_editor, DocsMode,
    FolderEditorState, FolderSubtab, NotificationState, SettingsModalState, TextArea, TextInput,
    ToastLevel, UnsavedModalState,
};
use crate::models::{
    ContextMenuState, ContextMenuTarget, EnvironmentState, GitState, PickerItem, PickerState,
    SnippetModalState, SseConnectionStatus, SseTabState, TerminalState, VaultState,
    WebSocketTabState, WorkspaceState, WsConnectionStatus,
};
use crate::theme::Theme;
use aether_core::engine::curl_parser;
use aether_core::engine::fs_scanner::{NodeType, WorkspaceTreeNode};
use aether_core::engine::git_engine;
use aether_core::engine::sse_client::SseManager;
use aether_core::engine::websocket_client::WebSocketManager;
use aether_core::models::app_config::AppConfig;
use aether_core::models::key_value::KeyValue;
use aether_core::models::request::{AuthConfig, RequestBody};
use gpui::prelude::*;
use gpui::*;
use std::path::Path;
use std::sync::Arc;

/// The main workspace view coordinating Sidebar, TabBar, Request Area, Terminal Panel, Modals and Command Palette.
pub struct WorkspaceView {
    pub state: WorkspaceState,
    pub env_state: EnvironmentState,
    pub git_state: GitState,
    pub folder_state: Option<FolderEditorState>,
    pub context_menu_state: ContextMenuState,
    pub terminal_state: TerminalState,
    pub picker_state: PickerState,
    pub vault_state: VaultState,
    pub snippet_modal_state: SnippetModalState,
    pub notification_state: NotificationState,
    pub about_modal_open: bool,
    pub settings_modal_state: SettingsModalState,
    pub unsaved_modal_state: UnsavedModalState,
    pub url_input: Entity<TextInput>,
    pub body_input: Entity<TextArea>,
    pub composer_input: Entity<TextArea>,
    pub picker_input: Entity<TextInput>,
    pub vault_input: Entity<TextInput>,
    pub git_commit_input: Entity<TextInput>,
    pub conflict_editor: Entity<TextArea>,
    pub docs_editor: Entity<TextArea>,
    pub folder_auth_input: Entity<TextInput>,
    pub proxy_input: Entity<TextInput>,
    pub ws_manager: Arc<WebSocketManager>,
    pub sse_manager: Arc<SseManager>,
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
                    && p.extension()
                        .map_or(false, |ext| ext == "yaml" || ext == "yml")
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
        let cfg = AppConfig::load();
        let initial_theme = match cfg.theme.as_str() {
            "light" => Theme::light(),
            "dracula" => Theme::dracula(),
            "nord" => Theme::nord(),
            _ => Theme::dark(),
        };

        let url_input = cx.new(|cx| {
            TextInput::new(
                cx,
                "Enter URL or paste curl command (e.g. https://api.example.com/v1/users)...",
                false,
            )
        });
        let body_input =
            cx.new(|cx| TextArea::new(cx, "Enter request payload body (JSON, XML, Text)...", true));
        let composer_input = cx.new(|cx| TextArea::new(cx, "{\n  \"action\": \"ping\"\n}", true));
        let picker_input = cx.new(|cx| TextInput::new(cx, "Search...", false));
        let vault_input =
            cx.new(|cx| TextInput::new(cx, "Enter Master Key or Passphrase...", true));
        let git_commit_input = cx.new(|cx| TextInput::new(cx, "Commit message...", false));
        let conflict_editor = cx.new(|cx| TextArea::new(cx, "Merged conflict content...", true));
        let docs_editor = cx.new(|cx| {
            TextArea::new(
                cx,
                "# Documentation\n\nWrite folder markdown documentation here...",
                true,
            )
        });
        let folder_auth_input =
            cx.new(|cx| TextInput::new(cx, "Enter token or credentials...", false));
        let proxy_input = cx.new(|cx| TextInput::new(cx, "http://127.0.0.1:8080", false));
        Self {
            state: WorkspaceState::new(),
            env_state: EnvironmentState::new(),
            git_state: GitState::new(),
            folder_state: None,
            context_menu_state: ContextMenuState::new(),
            terminal_state: TerminalState::new(),
            picker_state: PickerState::new(),
            vault_state: VaultState::new(),
            snippet_modal_state: SnippetModalState::new(),
            notification_state: NotificationState::new(),
            about_modal_open: false,
            settings_modal_state: SettingsModalState::new(),
            unsaved_modal_state: UnsavedModalState::new(),
            url_input,
            body_input,
            composer_input,
            picker_input,
            vault_input,
            git_commit_input,
            conflict_editor,
            docs_editor,
            folder_auth_input,
            proxy_input,
            ws_manager: Arc::new(WebSocketManager::new()),
            sse_manager: Arc::new(SseManager::new()),
            theme: initial_theme,
            focus_handle: cx.focus_handle(),
        }
    }

    pub fn with_workspace(path: &Path, cx: &mut Context<Self>) -> Self {
        let cfg = AppConfig::load();
        let initial_theme = match cfg.theme.as_str() {
            "light" => Theme::light(),
            "dracula" => Theme::dracula(),
            "nord" => Theme::nord(),
            _ => Theme::dark(),
        };

        let mut state = WorkspaceState::new();
        let _ = state.load_workspace(path);
        let mut env_state = EnvironmentState::new();
        let _ = env_state.load_from_workspace(path);
        let mut git_state = GitState::new();
        git_state.set_workspace(path);
        let mut recents = aether_core::models::recent_workspace::RecentWorkspacesList::load();
        recents.add_or_update(path, None);

        let mut vault_state = VaultState::new();
        if check_workspace_has_secrets(path) {
            vault_state.open_dialog();
        }

        let url_input = cx.new(|cx| {
            TextInput::new(
                cx,
                "Enter URL or paste curl command (e.g. https://api.example.com/v1/users)...",
                false,
            )
        });
        let body_input =
            cx.new(|cx| TextArea::new(cx, "Enter request payload body (JSON, XML, Text)...", true));
        let composer_input = cx.new(|cx| TextArea::new(cx, "{\n  \"action\": \"ping\"\n}", true));
        let picker_input = cx.new(|cx| TextInput::new(cx, "Search...", false));
        let vault_input =
            cx.new(|cx| TextInput::new(cx, "Enter Master Key or Passphrase...", true));
        let git_commit_input = cx.new(|cx| TextInput::new(cx, "Commit message...", false));
        let conflict_editor = cx.new(|cx| TextArea::new(cx, "Merged conflict content...", true));
        let docs_editor = cx.new(|cx| {
            TextArea::new(
                cx,
                "# Documentation\n\nWrite folder markdown documentation here...",
                true,
            )
        });
        let folder_auth_input =
            cx.new(|cx| TextInput::new(cx, "Enter token or credentials...", false));
        let proxy_input = cx.new(|cx| TextInput::new(cx, "http://127.0.0.1:8080", false));

        // Sync inputs with the first opened tab's state if available
        if let Some(tab) = state.active_tab() {
            let url = tab.request.url.clone();
            url_input.update(cx, |input, cx| {
                input.set_value(&url, cx);
            });
            let body_content = match &tab.request.body {
                RequestBody::Json { content } => content.clone(),
                RequestBody::Text { content } => content.clone(),
                RequestBody::Xml { content } => content.clone(),
                RequestBody::Yaml { content } => content.clone(),
                _ => String::new(),
            };
            body_input.update(cx, |input, cx| {
                input.set_value(&body_content, cx);
            });
        }

        let mut view = Self {
            state,
            env_state,
            git_state,
            folder_state: None,
            context_menu_state: ContextMenuState::new(),
            terminal_state: TerminalState::new(),
            picker_state: PickerState::new(),
            vault_state,
            snippet_modal_state: SnippetModalState::new(),
            notification_state: NotificationState::new(),
            about_modal_open: false,
            settings_modal_state: SettingsModalState::new(),
            unsaved_modal_state: UnsavedModalState::new(),
            url_input,
            body_input,
            composer_input,
            picker_input,
            vault_input,
            git_commit_input,
            conflict_editor,
            docs_editor,
            folder_auth_input,
            proxy_input,
            ws_manager: Arc::new(WebSocketManager::new()),
            sse_manager: Arc::new(SseManager::new()),
            theme: initial_theme,
            focus_handle: cx.focus_handle(),
        };
        view.start_fs_watcher(path, cx);
        view.refresh_git_status(cx);
        view
    }

    pub fn handle_key_down(
        &mut self,
        event: &KeyDownEvent,
        _window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let key = event.keystroke.key.as_str();
        let modifiers = &event.keystroke.modifiers;

        // 1. If Vault dialog is open, route keystrokes to master_key_input & vault_input
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
                    let val = self.vault_state.master_key_input.clone();
                    self.vault_input.update(cx, |input, cx| {
                        input.set_value(&val, cx);
                    });
                    cx.notify();
                }
                "space" => {
                    self.vault_state.master_key_input.push(' ');
                    self.vault_state.error_message = None;
                    let val = self.vault_state.master_key_input.clone();
                    self.vault_input.update(cx, |input, cx| {
                        input.set_value(&val, cx);
                    });
                    cx.notify();
                }
                _ => {
                    if modifiers.control && (key == "v" || key == "V") {
                        if let Some(clipboard) = cx.read_from_clipboard() {
                            if let Some(text) = clipboard.text() {
                                self.vault_state.master_key_input.push_str(&text);
                                self.vault_state.error_message = None;
                                let val = self.vault_state.master_key_input.clone();
                                self.vault_input.update(cx, |input, cx| {
                                    input.set_value(&val, cx);
                                });
                                cx.notify();
                            }
                        }
                    } else if !modifiers.control
                        && !modifiers.alt
                        && !modifiers.platform
                        && key.chars().count() == 1
                    {
                        self.vault_state.master_key_input.push_str(key);
                        self.vault_state.error_message = None;
                        let val = self.vault_state.master_key_input.clone();
                        self.vault_input.update(cx, |input, cx| {
                            input.set_value(&val, cx);
                        });
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
                    if !modifiers.control
                        && !modifiers.alt
                        && !modifiers.platform
                        && key.chars().count() == 1
                    {
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
            let _ = self.env_state.load_from_workspace(path);
            if check_workspace_has_secrets(path) && !self.vault_state.is_unlocked {
                self.vault_state.open_dialog();
            }
            self.git_state.set_workspace(path);
            self.refresh_git_status(cx);
            self.start_fs_watcher(path, cx);
            cx.notify();
        }
    }

    /// Spawns a recursive background filesystem watcher for the active workspace.
    pub fn start_fs_watcher(&mut self, workspace_path: &Path, cx: &mut Context<Self>) {
        let (raw_tx, raw_rx) = tokio::sync::mpsc::channel(100);
        let (change_tx, mut change_rx) = tokio::sync::mpsc::unbounded_channel();

        if let Ok(watcher) =
            aether_core::watcher::FsWatcher::new(workspace_path.to_path_buf(), raw_tx)
        {
            tokio::spawn(async move {
                let _keep_alive = watcher;
                aether_core::watcher::debounce::start_debounce_loop(raw_rx, change_tx).await;
            });

            cx.spawn(move |view: WeakEntity<WorkspaceView>, cx: &mut AsyncApp| {
                let mut cx = cx.clone();
                async move {
                    while let Some(_change) = change_rx.recv().await {
                        let _ = view.update(&mut cx, |this, cx| {
                            this.reload(cx);
                        });
                    }
                }
            })
            .detach();
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
        if let Some(root) = &self.state.workspace_root {
            let _ = self.env_state.load_from_workspace(root);
        }
        self.refresh_git_status(cx);
        if self.state.reload().is_ok() {
            cx.notify();
        }
    }

    /// Refreshes Git repository status and branch lists asynchronously.
    pub fn refresh_git_status(&mut self, cx: &mut Context<Self>) {
        let root = match &self.state.workspace_root {
            Some(r) => r.clone(),
            None => return,
        };

        if !root.join(".git").exists() {
            self.git_state.is_git_repo = false;
            self.git_state.status = None;
            self.git_state.branches.clear();
            cx.notify();
            return;
        }

        self.git_state.is_loading = true;
        self.git_state.is_git_repo = true;
        cx.notify();

        cx.spawn(move |view: WeakEntity<WorkspaceView>, cx: &mut AsyncApp| {
            let mut cx = cx.clone();
            async move {
                let status_res = git_engine::get_status(&root).await;
                let branches_res = git_engine::list_branches(&root).await;

                let _ = view.update(&mut cx, |this, cx| {
                    match status_res {
                        Ok(status) => {
                            this.git_state.update_status(status);
                        }
                        Err(err) => {
                            this.git_state
                                .set_error(format!("Failed to get Git status: {}", err));
                        }
                    }

                    if let Ok(branches) = branches_res {
                        this.git_state.update_branches(branches);
                    }
                    cx.notify();
                });
            }
        })
        .detach();
    }

    /// Stages specific files or all files.
    pub fn git_stage_files(&mut self, paths: &[String], cx: &mut Context<Self>) {
        let root = match &self.state.workspace_root {
            Some(r) => r.clone(),
            None => return,
        };
        let paths = paths.to_vec();

        cx.spawn(move |view: WeakEntity<WorkspaceView>, cx: &mut AsyncApp| {
            let mut cx = cx.clone();
            async move {
                let res = git_engine::stage_paths(&root, &paths).await;
                let _ = view.update(&mut cx, |this, cx| {
                    if let Err(err) = res {
                        this.git_state.set_error(format!("Stage failed: {}", err));
                    }
                    this.refresh_git_status(cx);
                });
            }
        })
        .detach();
    }

    /// Unstages specific files or all files.
    pub fn git_unstage_files(&mut self, paths: &[String], cx: &mut Context<Self>) {
        let root = match &self.state.workspace_root {
            Some(r) => r.clone(),
            None => return,
        };
        let paths = paths.to_vec();

        cx.spawn(move |view: WeakEntity<WorkspaceView>, cx: &mut AsyncApp| {
            let mut cx = cx.clone();
            async move {
                let res = git_engine::unstage_paths(&root, &paths).await;
                let _ = view.update(&mut cx, |this, cx| {
                    if let Err(err) = res {
                        this.git_state.set_error(format!("Unstage failed: {}", err));
                    }
                    this.refresh_git_status(cx);
                });
            }
        })
        .detach();
    }

    /// Discards changes in specific files or all files.
    pub fn git_discard_files(&mut self, paths: &[String], cx: &mut Context<Self>) {
        let root = match &self.state.workspace_root {
            Some(r) => r.clone(),
            None => return,
        };
        let paths = paths.to_vec();

        cx.spawn(move |view: WeakEntity<WorkspaceView>, cx: &mut AsyncApp| {
            let mut cx = cx.clone();
            async move {
                let res = git_engine::discard_changes(&root, &paths).await;
                let _ = view.update(&mut cx, |this, cx| {
                    if let Err(err) = res {
                        this.git_state.set_error(format!("Discard failed: {}", err));
                    }
                    this.reload(cx);
                });
            }
        })
        .detach();
    }

    /// Commits staged changes with the message typed in the commit input.
    pub fn git_commit(&mut self, cx: &mut Context<Self>) {
        let root = match &self.state.workspace_root {
            Some(r) => r.clone(),
            None => return,
        };

        let message = self.git_commit_input.read(cx).value().trim().to_string();
        if message.is_empty() {
            self.git_state
                .set_error("Please enter a commit message".to_string());
            cx.notify();
            return;
        }

        self.git_state.commit_in_progress = true;
        self.git_state.clear_error();
        cx.notify();

        let commit_input_entity = self.git_commit_input.clone();
        cx.spawn(move |view: WeakEntity<WorkspaceView>, cx: &mut AsyncApp| {
            let mut cx = cx.clone();
            async move {
                let res = git_engine::commit(&root, &message).await;
                let _ = view.update(&mut cx, |this, cx| {
                    this.git_state.commit_in_progress = false;
                    match res {
                        Ok(_) => {
                            commit_input_entity.update(cx, |input, cx| {
                                input.set_value("", cx);
                            });
                            this.refresh_git_status(cx);
                        }
                        Err(err) => {
                            this.git_state.set_error(format!("Commit failed: {}", err));
                            cx.notify();
                        }
                    }
                });
            }
        })
        .detach();
    }

    /// Performs safe smart sync (stash -> pull --rebase -> pop -> push).
    pub fn git_smart_sync(&mut self, cx: &mut Context<Self>) {
        let root = match &self.state.workspace_root {
            Some(r) => r.clone(),
            None => return,
        };

        self.git_state.sync_in_progress = true;
        self.git_state.clear_error();
        cx.notify();

        cx.spawn(move |view: WeakEntity<WorkspaceView>, cx: &mut AsyncApp| {
            let mut cx = cx.clone();
            async move {
                let res = git_engine::smart_sync(&root).await;
                let _ = view.update(&mut cx, |this, cx| {
                    this.git_state.sync_in_progress = false;
                    if let Err(err) = res {
                        this.git_state.set_error(format!("Sync failed: {}", err));
                    }
                    this.reload(cx);
                });
            }
        })
        .detach();
    }

    /// Initializes a new Git repository in the current workspace.
    pub fn git_init_repository(&mut self, cx: &mut Context<Self>) {
        let root = match &self.state.workspace_root {
            Some(r) => r.clone(),
            None => return,
        };

        cx.spawn(move |view: WeakEntity<WorkspaceView>, cx: &mut AsyncApp| {
            let mut cx = cx.clone();
            async move {
                let res = git_engine::run_git(&root, &["init"]).await;
                let _ = view.update(&mut cx, |this, cx| match res {
                    Ok(_) => {
                        this.git_state.is_git_repo = true;
                        this.refresh_git_status(cx);
                    }
                    Err(err) => {
                        this.git_state
                            .set_error(format!("Git init failed: {}", err));
                        cx.notify();
                    }
                });
            }
        })
        .detach();
    }

    /// Opens the Branch Switcher modal / quick picker.
    pub fn git_open_branch_picker(&mut self, cx: &mut Context<Self>) {
        let mut items = Vec::new();
        for b in &self.git_state.branches {
            items.push(PickerItem {
                id: format!("branch_{}", b.name),
                title: b.name.clone(),
                subtitle: if b.is_current {
                    Some("Current active branch".to_string())
                } else if b.is_remote {
                    Some("Remote tracking branch".to_string())
                } else {
                    Some("Local branch".to_string())
                },
                badge: if b.is_current {
                    Some("ACTIVE".to_string())
                } else {
                    None
                },
                shortcut: None,
            });
        }
        self.picker_state.open_command_palette(items);
        self.picker_input.update(cx, |input, cx| {
            input.set_value("", cx);
        });
        cx.notify();
    }

    /// Checks out a branch or creates a new one.
    pub fn git_checkout_branch(&mut self, branch: &str, create: bool, cx: &mut Context<Self>) {
        let root = match &self.state.workspace_root {
            Some(r) => r.clone(),
            None => return,
        };
        let branch = branch.to_string();

        cx.spawn(move |view: WeakEntity<WorkspaceView>, cx: &mut AsyncApp| {
            let mut cx = cx.clone();
            async move {
                let res = git_engine::checkout_branch(&root, &branch, create).await;
                let _ = view.update(&mut cx, |this, cx| {
                    if let Err(err) = res {
                        this.git_state
                            .set_error(format!("Checkout failed: {}", err));
                    }
                    this.reload(cx);
                });
            }
        })
        .detach();
    }

    /// Opens the 3-way Conflict Resolver modal for a specific file path.
    pub fn open_conflict_resolver(&mut self, file_path: &str, cx: &mut Context<Self>) {
        let root = match &self.state.workspace_root {
            Some(r) => r.clone(),
            None => return,
        };
        let file_path = file_path.to_string();
        let editor = self.conflict_editor.clone();

        cx.spawn(move |view: WeakEntity<WorkspaceView>, cx: &mut AsyncApp| {
            let mut cx = cx.clone();
            async move {
                let res = git_engine::get_conflict_file_info(&root, &file_path).await;
                let _ = view.update(&mut cx, |this, cx| {
                    match res {
                        Ok(info) => {
                            let initial_text = info.ours_content.clone();
                            editor.update(cx, |input, cx| {
                                input.set_value(&initial_text, cx);
                            });
                            this.git_state.set_active_conflict(Some(info));
                        }
                        Err(err) => {
                            this.git_state
                                .set_error(format!("Failed to parse conflict: {}", err));
                        }
                    }
                    cx.notify();
                });
            }
        })
        .detach();
    }

    /// Resolves active conflict by writing the merged content and staging the file.
    pub fn resolve_active_conflict(&mut self, file_path: &str, cx: &mut Context<Self>) {
        let root = match &self.state.workspace_root {
            Some(r) => r.clone(),
            None => return,
        };
        let file_path = file_path.to_string();
        let merged_content = self.conflict_editor.read(cx).value().to_string();

        cx.spawn(move |view: WeakEntity<WorkspaceView>, cx: &mut AsyncApp| {
            let mut cx = cx.clone();
            async move {
                let res = git_engine::resolve_conflict(&root, &file_path, &merged_content).await;
                let _ = view.update(&mut cx, |this, cx| match res {
                    Ok(_) => {
                        this.git_state.set_active_conflict(None);
                        this.refresh_git_status(cx);
                    }
                    Err(err) => {
                        this.git_state
                            .set_error(format!("Conflict resolution failed: {}", err));
                        cx.notify();
                    }
                });
            }
        })
        .detach();
    }

    pub fn toggle_node(&mut self, node_id: &str, cx: &mut Context<Self>) {
        self.state.toggle_expanded(node_id);
        cx.notify();
    }

    pub fn open_request(&mut self, node: &WorkspaceTreeNode, cx: &mut Context<Self>) {
        self.folder_state = None;
        self.state.open_request(node);
        self.sync_url_from_tab(cx);
        self.sync_body_from_tab(cx);
        cx.notify();
    }

    /// Opens the folder settings view for a given folder or collection node.
    pub fn open_folder_settings(
        &mut self,
        folder_id: &str,
        folder_name: &str,
        relative_path: &str,
        cx: &mut Context<Self>,
    ) {
        let mut state = FolderEditorState::new(
            folder_id.to_string(),
            folder_name.to_string(),
            relative_path.to_string(),
        );

        let path = Path::new(relative_path);
        let folder_meta = if path.is_dir() {
            path.join("_folder.yaml")
        } else {
            path.to_path_buf()
        };

        if folder_meta.exists() {
            if let Ok(folder) = aether_core::engine::yaml_parser::read_and_validate_yaml::<
                aether_core::models::folder::Folder,
            >(&folder_meta)
            {
                if let Some(auth) = folder.auth {
                    state.auth = auth;
                }
                if let Some(headers) = folder.headers {
                    state.headers = headers;
                }
                state.docs = folder.description.unwrap_or_default();
            }
        }

        let initial_docs = state.docs.clone();
        self.docs_editor.update(cx, |input, cx| {
            input.set_value(&initial_docs, cx);
        });

        self.folder_state = Some(state);
        cx.notify();
    }

    /// Closes folder settings and returns to request tabs.
    pub fn close_folder_settings(&mut self, cx: &mut Context<Self>) {
        self.folder_state = None;
        cx.notify();
    }

    /// Sets documentation view mode (Edit, Split, Preview).
    pub fn set_docs_mode(&mut self, mode: DocsMode, cx: &mut Context<Self>) {
        if let Some(folder) = &mut self.folder_state {
            folder.docs_mode = mode;
            cx.notify();
        }
    }

    /// Switches folder editor subtab (Auth, Headers, Docs).
    pub fn set_folder_subtab(&mut self, subtab: FolderSubtab, cx: &mut Context<Self>) {
        if let Some(folder) = &mut self.folder_state {
            folder.active_subtab = subtab;
            cx.notify();
        }
    }

    /// Updates folder authentication config.
    pub fn update_folder_auth(&mut self, auth: AuthConfig, cx: &mut Context<Self>) {
        if let Some(folder) = &mut self.folder_state {
            folder.auth = auth;
            folder.is_dirty = true;
            cx.notify();
        }
    }

    /// Updates folder shared headers.
    pub fn update_folder_headers(&mut self, headers: Vec<KeyValue>, cx: &mut Context<Self>) {
        if let Some(folder) = &mut self.folder_state {
            folder.headers = headers;
            folder.is_dirty = true;
            cx.notify();
        }
    }

    /// Saves folder settings to `_folder.yaml`.
    pub fn save_folder_settings(&mut self, cx: &mut Context<Self>) {
        if let Some(folder) = &mut self.folder_state {
            let docs_content = self.docs_editor.read(cx).value().to_string();
            folder.docs = docs_content.clone();

            let path = Path::new(&folder.relative_path);
            let folder_meta = if path.is_dir() {
                path.join("_folder.yaml")
            } else {
                path.to_path_buf()
            };

            let mut folder_obj = aether_core::models::folder::Folder::new(&folder.name);
            folder_obj.auth = Some(folder.auth.clone());
            folder_obj.headers = Some(folder.headers.clone());
            folder_obj.description = if docs_content.trim().is_empty() {
                None
            } else {
                Some(docs_content)
            };

            let folder_name = folder.name.clone();
            if aether_core::engine::yaml_parser::atomic_write_yaml(&folder_meta, &folder_obj)
                .is_ok()
            {
                folder.is_dirty = false;
                self.show_toast(
                    ToastLevel::Success,
                    "Folder Saved",
                    format!("Saved settings for \"{}\"", folder_name),
                    cx,
                );
                cx.notify();
            }
        }
    }

    /// Opens OS File Picker dialog to select a binary file for RequestBody::Binary.
    pub fn pick_binary_body_file(&mut self, cx: &mut Context<Self>) {
        cx.spawn(|view: WeakEntity<WorkspaceView>, cx: &mut AsyncApp| {
            let mut cx = cx.clone();
            async move {
                if let Some(file) = rfd::AsyncFileDialog::new().pick_file().await {
                    let path = file.path().to_string_lossy().to_string();
                    let _ = view.update(&mut cx, |this, cx| {
                        if let Some(tab) = this.state.active_tab_mut() {
                            tab.request.body = RequestBody::Binary { file_path: path };
                            tab.is_dirty = true;
                            cx.notify();
                        }
                    });
                }
            }
        })
        .detach();
    }

    pub fn select_tab(&mut self, index: usize, cx: &mut Context<Self>) {
        self.folder_state = None;
        self.state.select_tab(index);
        self.sync_url_from_tab(cx);
        self.sync_body_from_tab(cx);
        cx.notify();
    }

    pub fn show_toast(
        &mut self,
        level: ToastLevel,
        title: impl Into<String>,
        message: impl Into<String>,
        cx: &mut Context<Self>,
    ) {
        self.notification_state.show(level, title, message);
        cx.notify();
    }

    pub fn dismiss_toast(&mut self, id: &str, cx: &mut Context<Self>) {
        self.notification_state.dismiss(id);
        cx.notify();
    }

    pub fn open_about_modal(&mut self, cx: &mut Context<Self>) {
        self.about_modal_open = true;
        cx.notify();
    }

    pub fn close_about_modal(&mut self, cx: &mut Context<Self>) {
        self.about_modal_open = false;
        cx.notify();
    }

    pub fn open_settings_modal(&mut self, cx: &mut Context<Self>) {
        self.settings_modal_state.open();
        let proxy_val = self
            .settings_modal_state
            .config
            .proxy_url
            .clone()
            .unwrap_or_default();
        self.proxy_input.update(cx, |input, cx| {
            input.set_value(&proxy_val, cx);
        });
        cx.notify();
    }

    pub fn save_settings_and_close(&mut self, cx: &mut Context<Self>) {
        let proxy_text = self.proxy_input.read(cx).value().trim().to_string();
        self.settings_modal_state.config.proxy_url = if proxy_text.is_empty() {
            None
        } else {
            Some(proxy_text)
        };
        let _ = self.settings_modal_state.config.save();
        self.settings_modal_state.close();
        self.show_toast(
            ToastLevel::Success,
            "Settings Saved",
            "Application settings updated",
            cx,
        );
        cx.notify();
    }

    pub fn set_theme_and_save(&mut self, theme_name: &str, cx: &mut Context<Self>) {
        self.settings_modal_state.config.theme = theme_name.to_string();
        let _ = self.settings_modal_state.config.save();
        self.theme = match theme_name {
            "light" => Theme::light(),
            "dracula" => Theme::dracula(),
            "nord" => Theme::nord(),
            _ => Theme::dark(),
        };
        cx.notify();
    }

    pub fn cancel_active_request(&mut self, cx: &mut Context<Self>) {
        if let Some(tab) = self.state.active_tab_mut() {
            if tab.is_sending {
                tab.is_sending = false;
                tab.error_message = Some("Request cancelled by user".to_string());
                self.show_toast(
                    ToastLevel::Info,
                    "Cancelled",
                    "Request execution was cancelled",
                    cx,
                );
                cx.notify();
            }
        }
    }

    pub fn close_tab(&mut self, index: usize, cx: &mut Context<Self>) {
        if let Some(tab) = self.state.tabs.get(index) {
            if tab.is_dirty {
                self.unsaved_modal_state
                    .prompt(index, tab.request.name.clone());
                cx.notify();
                return;
            }
        }
        self.force_close_tab(index, cx);
    }

    pub fn force_close_tab(&mut self, index: usize, cx: &mut Context<Self>) {
        self.state.close_tab(index);
        cx.notify();
    }

    pub fn save_tab_and_close(&mut self, index: usize, cx: &mut Context<Self>) {
        if let Some(tab) = self.state.tabs.get(index) {
            let req_path = tab.file_path.clone();
            let req_data = tab.request.clone();
            if aether_core::engine::yaml_parser::atomic_write_yaml(&req_path, &req_data).is_ok() {
                self.show_toast(
                    ToastLevel::Success,
                    "Saved",
                    format!("Saved \"{}\"", req_data.name),
                    cx,
                );
            }
        }
        self.force_close_tab(index, cx);
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
        self.vault_state.master_key_input.clear();
        self.vault_state.error_message = None;
        self.vault_input.update(cx, |input, cx| {
            input.set_value("", cx);
        });
        cx.notify();
    }

    /// Unlocks the vault with master key passphrase.
    pub fn unlock_vault(&mut self, cx: &mut Context<Self>) {
        let input_val = self.vault_input.read(cx).value().trim().to_string();
        let passphrase = if !input_val.is_empty() {
            input_val
        } else {
            self.vault_state.master_key_input.trim().to_string()
        };

        if passphrase.is_empty() {
            self.vault_state.error_message =
                Some("Master Key / Passphrase cannot be empty".to_string());
            cx.notify();
            return;
        }

        // Collect all encrypted secret strings from all environments
        let mut encrypted_secrets = Vec::new();
        for entry in &self.env_state.entries {
            for var in &entry.environment.variables {
                if var.var_type == aether_core::models::environment::VariableType::Secret
                    && var.value.starts_with("enc:aes-gcm:")
                {
                    encrypted_secrets.push(var.value.clone());
                }
            }
        }

        let ws_salt = self.state.workspace_salt.as_deref();
        match self
            .vault_state
            .unlock(&passphrase, ws_salt, &encrypted_secrets)
        {
            Ok(()) => {
                self.show_toast(
                    ToastLevel::Success,
                    "Vault Unlocked",
                    "Secrets decrypted successfully",
                    cx,
                );
            }
            Err(err) => {
                self.show_toast(ToastLevel::Error, "Unlock Failed", &err.to_string(), cx);
            }
        }
        cx.notify();
    }

    /// Sync url_input TextInput entity value FROM the active tab's URL.
    /// Called when switching tabs or opening a new request.
    pub fn sync_url_from_tab(&mut self, cx: &mut Context<Self>) {
        if let Some(tab) = self.state.active_tab() {
            let url = tab.request.url.clone();
            self.url_input.update(cx, |input, cx| {
                input.set_value(&url, cx);
            });
        } else {
            self.url_input.update(cx, |input, cx| {
                input.set_value("", cx);
            });
        }
    }

    /// Sync url_input TextInput value TO the active tab's request URL.
    /// Automatically detects and parses pasted cURL commands.
    pub fn sync_url_to_tab(&mut self, cx: &mut Context<Self>) {
        let text = self.url_input.read(cx).value().to_string();
        if text.trim().starts_with("curl ") || text.trim().starts_with("curl.exe ") {
            if let Ok(parsed) = curl_parser::parse_curl(&text) {
                if let Some(tab) = self.state.active_tab_mut() {
                    tab.request = parsed;
                    tab.is_dirty = true;
                }
                let clean_url = self
                    .state
                    .active_tab()
                    .map(|t| t.request.url.clone())
                    .unwrap_or_default();
                self.url_input.update(cx, |input, cx| {
                    input.set_value(&clean_url, cx);
                });
                self.sync_body_from_tab(cx);
                cx.notify();
                return;
            }
        }
        if let Some(tab) = self.state.active_tab_mut() {
            if tab.request.url != text {
                tab.request.url = text;
                tab.is_dirty = true;
            }
        }
    }

    /// Sync body_input TextArea entity value FROM the active tab's payload body.
    pub fn sync_body_from_tab(&mut self, cx: &mut Context<Self>) {
        if let Some(tab) = self.state.active_tab() {
            let content = match &tab.request.body {
                RequestBody::Json { content } => content.clone(),
                RequestBody::Text { content } => content.clone(),
                RequestBody::Xml { content } => content.clone(),
                RequestBody::Yaml { content } => content.clone(),
                _ => String::new(),
            };
            self.body_input.update(cx, |input, cx| {
                input.set_value(&content, cx);
            });
        } else {
            self.body_input.update(cx, |input, cx| {
                input.set_value("", cx);
            });
        }
    }

    /// Sync body_input TextArea value TO the active tab's request body.
    pub fn sync_body_to_tab(&mut self, cx: &mut Context<Self>) {
        let body_text = self.body_input.read(cx).value().to_string();
        if let Some(tab) = self.state.active_tab_mut() {
            match &mut tab.request.body {
                RequestBody::Json { content } => {
                    if *content != body_text {
                        *content = body_text;
                        tab.is_dirty = true;
                    }
                }
                RequestBody::Text { content } => {
                    if *content != body_text {
                        *content = body_text;
                        tab.is_dirty = true;
                    }
                }
                RequestBody::Xml { content } => {
                    if *content != body_text {
                        *content = body_text;
                        tab.is_dirty = true;
                    }
                }
                RequestBody::Yaml { content } => {
                    if *content != body_text {
                        *content = body_text;
                        tab.is_dirty = true;
                    }
                }
                _ => {}
            }
        }
    }

    /// Opens Quick Open modal with all requests in the workspace.
    pub fn open_quick_open(&mut self, cx: &mut Context<Self>) {
        let mut items = Vec::new();
        if let Some(tree) = &self.state.tree {
            collect_request_items(&tree.children, &mut items);
        }
        self.picker_state.open_quick_open(items);
        self.picker_input.update(cx, |input, cx| {
            input.set_value("", cx);
        });
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
            PickerItem {
                id: "cmd_git_sync".to_string(),
                title: "Git: Smart Sync".to_string(),
                subtitle: Some("Fetch, Pull --rebase, and Push to remote".to_string()),
                badge: Some("GIT".to_string()),
                shortcut: None,
            },
            PickerItem {
                id: "cmd_git_stage_all".to_string(),
                title: "Git: Stage All Changes".to_string(),
                subtitle: Some("Stage all unstaged and untracked files".to_string()),
                badge: Some("GIT".to_string()),
                shortcut: None,
            },
            PickerItem {
                id: "cmd_git_branch".to_string(),
                title: "Git: Switch Branch...".to_string(),
                subtitle: Some("Checkout local or remote branch".to_string()),
                badge: Some("GIT".to_string()),
                shortcut: None,
            },
            PickerItem {
                id: "cmd_settings".to_string(),
                title: "Preferences: Open Settings...".to_string(),
                subtitle: Some("Themes, font size, HTTP proxy, and network timeouts".to_string()),
                badge: Some("CONFIG".to_string()),
                shortcut: Some("Ctrl+,".to_string()),
            },
            PickerItem {
                id: "cmd_about".to_string(),
                title: "Help: About Aether API".to_string(),
                subtitle: Some("Version, architecture, and system information".to_string()),
                badge: None,
                shortcut: None,
            },
        ];
        self.picker_state.open_command_palette(items);
        self.picker_input.update(cx, |input, cx| {
            input.set_value("", cx);
        });
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
        } else if item_id.starts_with("branch_") {
            let branch = &item_id[7..];
            self.git_checkout_branch(branch, false, cx);
        } else {
            match item_id {
                "cmd_open_folder" => self.open_folder_dialog(cx),
                "cmd_reload" => self.reload(cx),
                "cmd_send" => self.send_active_request(cx),
                "cmd_save" => self.save_active_request(cx),
                "cmd_snippet" => self.open_snippet_modal(cx),
                "cmd_vault" => self.open_vault_dialog(cx),
                "cmd_terminal" => self.toggle_terminal(cx),
                "cmd_quick_open" => self.open_quick_open(cx),
                "cmd_git_sync" => self.git_smart_sync(cx),
                "cmd_git_stage_all" => self.git_stage_files(&[], cx),
                "cmd_git_branch" => self.git_open_branch_picker(cx),
                "cmd_settings" => self.open_settings_modal(cx),
                "cmd_about" => self.open_about_modal(cx),
                _ => {}
            }
        }
    }

    /// Sends the currently active HTTP request and updates the tab state with the response.
    pub fn save_active_request(&mut self, cx: &mut Context<Self>) {
        self.sync_url_to_tab(cx);
        self.sync_body_to_tab(cx);
        if let Some(tab) = self.state.active_tab_mut() {
            let name = tab.request.name.clone();
            if tab.save().is_ok() {
                self.show_toast(
                    ToastLevel::Success,
                    "Request Saved",
                    format!("Saved \"{}\"", name),
                    cx,
                );
            }
            cx.notify();
        }
    }

    /// Switches the active tab's protocol (HTTP, WebSocket, SSE).
    pub fn switch_tab_protocol(&mut self, protocol: &str, cx: &mut Context<Self>) {
        if let Some(tab) = self.state.active_tab_mut() {
            tab.request.protocol = protocol.to_string();
            tab.is_dirty = true;
            if protocol == "websocket" && tab.ws_state.is_none() {
                tab.ws_state = Some(WebSocketTabState::new());
            } else if protocol == "sse" && tab.sse_state.is_none() {
                tab.sse_state = Some(SseTabState::new());
            }
        }
        self.state.save_session();
        cx.notify();
    }

    /// Executes an action chosen from the Context Menu popup.
    pub fn execute_context_menu_action(&mut self, action_id: &str, cx: &mut Context<Self>) {
        let target = self.context_menu_state.target.take();
        self.context_menu_state.close();

        match (action_id, target) {
            ("folder_settings", Some(ContextMenuTarget::TreeNode(node))) => {
                self.open_folder_settings(&node.id, &node.name, &node.path, cx);
            }

            ("new_request", Some(ContextMenuTarget::TreeNode(node))) => {
                let parent_path = Path::new(&node.path);
                let dir = if parent_path.is_dir() {
                    parent_path.to_path_buf()
                } else {
                    parent_path.parent().unwrap_or(parent_path).to_path_buf()
                };
                let mut req_name = "New Request".to_string();
                let mut file_path = dir.join(format!("{}.yaml", req_name));
                let mut count = 1;
                while file_path.exists() {
                    count += 1;
                    req_name = format!("New Request {}", count);
                    file_path = dir.join(format!("{}.yaml", req_name));
                }
                let mut req = aether_core::models::request::Request::new(&req_name);
                req.url = "https://api.example.com/v1/resource".to_string();
                if aether_core::engine::yaml_parser::atomic_write_yaml(&file_path, &req).is_ok() {
                    self.reload(cx);
                    let tree_node = WorkspaceTreeNode {
                        id: file_path.to_string_lossy().to_string(),
                        name: req_name,
                        path: file_path.to_string_lossy().to_string(),
                        node_type: NodeType::Request,
                        seq: None,
                        method: Some("GET".to_string()),
                        protocol: Some("http".to_string()),
                        children: Vec::new(),
                    };
                    self.open_request(&tree_node, cx);
                }
            }
            ("new_folder", Some(ContextMenuTarget::TreeNode(node))) => {
                let parent_path = Path::new(&node.path);
                let dir = if parent_path.is_dir() {
                    parent_path.to_path_buf()
                } else {
                    parent_path.parent().unwrap_or(parent_path).to_path_buf()
                };
                let mut folder_name = "New Folder".to_string();
                let mut folder_path = dir.join(&folder_name);
                let mut count = 1;
                while folder_path.exists() {
                    count += 1;
                    folder_name = format!("New Folder {}", count);
                    folder_path = dir.join(&folder_name);
                }
                let _ = std::fs::create_dir_all(&folder_path);
                let folder_meta = folder_path.join("_folder.yaml");
                let folder_obj = aether_core::models::folder::Folder::new(&folder_name);
                let _ =
                    aether_core::engine::yaml_parser::atomic_write_yaml(&folder_meta, &folder_obj);
                self.reload(cx);
            }
            ("open", Some(ContextMenuTarget::TreeNode(node))) => {
                self.open_request(&node, cx);
            }
            ("duplicate", Some(ContextMenuTarget::TreeNode(node))) => {
                let path = Path::new(&node.path);
                if path.is_file() {
                    if let Ok(mut req) = aether_core::engine::yaml_parser::read_and_validate_yaml::<
                        aether_core::models::request::Request,
                    >(path)
                    {
                        let parent = path.parent().unwrap_or(path);
                        let file_stem = path
                            .file_stem()
                            .and_then(|s| s.to_str())
                            .unwrap_or("request");
                        let new_name = format!("{} (Copy)", req.name);
                        req.name = new_name.clone();
                        let new_file_path = parent.join(format!("{} (Copy).yaml", file_stem));
                        if aether_core::engine::yaml_parser::atomic_write_yaml(&new_file_path, &req)
                            .is_ok()
                        {
                            self.reload(cx);
                            let tree_node = WorkspaceTreeNode {
                                id: new_file_path.to_string_lossy().to_string(),
                                name: new_name,
                                path: new_file_path.to_string_lossy().to_string(),
                                node_type: NodeType::Request,
                                seq: None,
                                method: Some(req.method.to_string()),
                                protocol: Some(req.protocol.clone()),
                                children: Vec::new(),
                            };
                            self.open_request(&tree_node, cx);
                        }
                    }
                }
            }
            ("copy_curl", Some(ContextMenuTarget::TreeNode(node))) => {
                let path = Path::new(&node.path);
                if let Ok(req) = aether_core::engine::yaml_parser::read_and_validate_yaml::<
                    aether_core::models::request::Request,
                >(path)
                {
                    let curl = aether_core::engine::snippet_generator::generate_snippet(
                        &req,
                        aether_core::engine::snippet_generator::SnippetLanguage::Curl,
                    );
                    cx.write_to_clipboard(ClipboardItem::new_string(curl));
                }
            }
            ("copy_path", Some(ContextMenuTarget::TreeNode(node))) => {
                cx.write_to_clipboard(ClipboardItem::new_string(node.path));
            }
            ("delete", Some(ContextMenuTarget::TreeNode(node))) => {
                let path = Path::new(&node.path);
                if path.is_dir() {
                    let _ = std::fs::remove_dir_all(path);
                } else if path.is_file() {
                    let _ = std::fs::remove_file(path);
                }
                // Close tab if open
                if let Some(idx) = self.state.tabs.iter().position(|t| t.file_path == path) {
                    self.close_tab(idx, cx);
                }
                self.reload(cx);
            }
            ("expand_all", Some(ContextMenuTarget::TreeNode(node))) => {
                fn expand_recursive(node: &WorkspaceTreeNode, state: &mut WorkspaceState) {
                    state.expanded_nodes.insert(node.id.clone());
                    for child in &node.children {
                        expand_recursive(child, state);
                    }
                }
                expand_recursive(&node, &mut self.state);
                cx.notify();
            }
            ("collapse_all", Some(ContextMenuTarget::TreeNode(node))) => {
                fn collapse_recursive(node: &WorkspaceTreeNode, state: &mut WorkspaceState) {
                    state.expanded_nodes.remove(&node.id);
                    for child in &node.children {
                        collapse_recursive(child, state);
                    }
                }
                collapse_recursive(&node, &mut self.state);
                cx.notify();
            }
            ("close_tab", Some(ContextMenuTarget::Tab(idx))) => {
                self.close_tab(idx, cx);
            }
            ("close_other_tabs", Some(ContextMenuTarget::Tab(idx))) => {
                if idx < self.state.tabs.len() {
                    let kept = self.state.tabs[idx].clone();
                    self.state.tabs = vec![kept];
                    self.state.active_tab_index = 0;
                    self.sync_url_from_tab(cx);
                    self.sync_body_from_tab(cx);
                    self.state.save_session();
                    cx.notify();
                }
            }
            ("close_all_tabs", Some(ContextMenuTarget::Tab(_))) => {
                self.state.tabs.clear();
                self.state.active_tab_index = 0;
                self.state.save_session();
                cx.notify();
            }
            ("duplicate_tab", Some(ContextMenuTarget::Tab(idx))) => {
                if idx < self.state.tabs.len() {
                    let mut dup = self.state.tabs[idx].clone();
                    dup.id = uuid::Uuid::new_v4().to_string();
                    dup.request.name = format!("{} (Copy)", dup.request.name);
                    self.state.tabs.insert(idx + 1, dup);
                    self.select_tab(idx + 1, cx);
                }
            }
            ("copy_tab_path", Some(ContextMenuTarget::Tab(idx))) => {
                if let Some(tab) = self.state.tabs.get(idx) {
                    cx.write_to_clipboard(ClipboardItem::new_string(
                        tab.file_path.to_string_lossy().to_string(),
                    ));
                }
            }
            _ => {}
        }
    }

    /// Toggles active WebSocket connection on / off.
    pub fn toggle_websocket_connection(&mut self, cx: &mut Context<Self>) {
        self.sync_url_to_tab(cx);
        let tab_idx = self.state.active_tab_index;
        let tab = match self.state.tabs.get_mut(tab_idx) {
            Some(t) => t,
            None => return,
        };

        if let Some(ws) = tab.ws_state.as_mut() {
            if ws.connection_status == WsConnectionStatus::Connected {
                let manager = self.ws_manager.clone();
                let tab_id = tab.id.clone();
                tokio::spawn(async move {
                    let _ = manager.disconnect(&tab_id, None, None).await;
                });
                ws.connection_status = WsConnectionStatus::Disconnected;
                cx.notify();
                return;
            }

            ws.connection_status = WsConnectionStatus::Connecting;
            let tab_id = tab.id.clone();
            let url = tab.request.url.clone();
            let headers = tab.request.headers.clone();
            let subprotocols: Vec<String> = Vec::new();
            let settings = tab.request.ws_settings.clone().unwrap_or_default();
            let req_settings = tab.request.settings.clone();
            let manager = self.ws_manager.clone();

            let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
            ws.tx = Some(tx.clone());
            cx.notify();

            cx.spawn(move |view: WeakEntity<WorkspaceView>, cx: &mut AsyncApp| {
                let mut cx = cx.clone();
                async move {
                    let tab_id_clone = tab_id.clone();
                    tokio::spawn(async move {
                        let _ = manager
                            .connect(
                                tx,
                                tab_id_clone,
                                url,
                                headers,
                                subprotocols,
                                settings,
                                req_settings,
                            )
                            .await;
                    });

                    while let Some(event) = rx.recv().await {
                        let _ = view.update(&mut cx, |this, cx| {
                            if let Some(tab) = this.state.tabs.get_mut(tab_idx) {
                                if let Some(ws) = tab.ws_state.as_mut() {
                                    ws.handle_event(event);
                                }
                            }
                            cx.notify();
                        });
                    }
                }
            })
            .detach();
        }
    }

    /// Sends a WebSocket frame payload through active connection.
    pub fn send_websocket_message(&mut self, cx: &mut Context<Self>) {
        let payload = self.composer_input.read(cx).value().to_string();
        let tab_idx = self.state.active_tab_index;
        let tab = match self.state.tabs.get_mut(tab_idx) {
            Some(t) => t,
            None => return,
        };

        if let Some(ws) = tab.ws_state.as_mut() {
            if ws.connection_status == WsConnectionStatus::Connected {
                if let Some(tx) = ws.tx.clone() {
                    let tab_id = tab.id.clone();
                    let format = ws.composer_format.clone();
                    let manager = self.ws_manager.clone();

                    tokio::spawn(async move {
                        let _ = manager.send_message(&tx, &tab_id, &format, &payload).await;
                    });
                }
            }
        }
    }

    /// Toggles active Server-Sent Events (SSE) connection on / off.
    pub fn toggle_sse_connection(&mut self, cx: &mut Context<Self>) {
        self.sync_url_to_tab(cx);
        self.sync_body_to_tab(cx);
        let tab_idx = self.state.active_tab_index;
        let tab = match self.state.tabs.get_mut(tab_idx) {
            Some(t) => t,
            None => return,
        };

        if let Some(sse) = tab.sse_state.as_mut() {
            if sse.connection_status == SseConnectionStatus::Connected {
                let manager = self.sse_manager.clone();
                let tab_id = tab.id.clone();
                tokio::spawn(async move {
                    let _ = manager.disconnect(&tab_id).await;
                });
                sse.connection_status = SseConnectionStatus::Disconnected;
                cx.notify();
                return;
            }

            sse.connection_status = SseConnectionStatus::Connecting;
            let tab_id = tab.id.clone();
            let method = tab.request.method.clone();
            let url = tab.request.url.clone();
            let params = tab.request.params.clone();
            let headers = tab.request.headers.clone();
            let body = tab.request.body.clone();
            let auth = tab.request.auth.clone();
            let settings = tab.request.sse_settings.clone().unwrap_or_default();
            let req_settings = tab.request.settings.clone();
            let manager = self.sse_manager.clone();

            let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
            cx.notify();

            cx.spawn(move |view: WeakEntity<WorkspaceView>, cx: &mut AsyncApp| {
                let mut cx = cx.clone();
                async move {
                    let tab_id_clone = tab_id.clone();
                    tokio::spawn(async move {
                        let _ = manager
                            .connect(
                                tx,
                                tab_id_clone,
                                method,
                                url,
                                params,
                                headers,
                                body,
                                auth,
                                settings,
                                req_settings,
                            )
                            .await;
                    });

                    while let Some(msg) = rx.recv().await {
                        let _ = view.update(&mut cx, |this, cx| {
                            if let Some(tab) = this.state.tabs.get_mut(tab_idx) {
                                if let Some(sse) = tab.sse_state.as_mut() {
                                    sse.handle_message(msg);
                                }
                            }
                            cx.notify();
                        });
                    }
                }
            })
            .detach();
        }
    }

    pub fn send_active_request(&mut self, cx: &mut Context<Self>) {
        self.sync_url_to_tab(cx);
        self.sync_body_to_tab(cx);
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
        let key_ref = self.vault_state.cached_key_base64.as_deref();
        let ws_salt = self.state.workspace_salt.as_deref();
        let vars = self.env_state.resolve_variables_map(key_ref, ws_salt);
        cx.notify();

        cx.spawn(move |view: WeakEntity<WorkspaceView>, cx: &mut AsyncApp| {
            let cx = cx.clone();
            async move {
                let mut cx = cx;
                let result = tab_clone.execute_request_with_vars(&vars).await;

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
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
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
            // Far-left Activity Bar rail
            .child(render_activity_bar(
                self.state.sidebar_tab,
                self.state.sidebar_collapsed,
                theme,
                entity.clone(),
                self.git_state.total_changes_count(),
            ))
            // Left Sidebar (collapsible)
            .when(!self.state.sidebar_collapsed, |this| {
                this.child(render_sidebar(
                    &self.state,
                    &self.git_state,
                    theme,
                    entity.clone(),
                    self.git_commit_input.clone(),
                ))
            })
            // Center Main Area
            .child(
                div()
                    .flex()
                    .flex_col()
                    .flex_1()
                    .h_full()
                    // Top Tab Bar
                    .child(render_tab_bar(&self.state, theme, entity.clone()))
                    // Request & Response Content Area, Environment Panel, or Folder Editor
                    .child(
                        if self.state.sidebar_tab == crate::models::workspace_state::SidebarTab::Environments {
                            div()
                                .flex()
                                .flex_col()
                                .flex_1()
                                .child(render_environment_panel(
                                    &self.env_state,
                                    &self.vault_state,
                                    theme,
                                    entity.clone(),
                                ))
                        } else if let Some(ref folder) = self.folder_state {
                            div()
                                .flex()
                                .flex_col()
                                .flex_1()
                                .child(render_folder_editor(
                                    folder,
                                    theme,
                                    entity.clone(),
                                    self.docs_editor.clone(),
                                    self.folder_auth_input.clone(),
                                ))
                        } else {
                            div()
                                .flex()
                                .flex_col()
                                .flex_1()
                                .p_4()
                                .when_some(active_tab, |this, tab| {
                                    match tab.request.protocol.as_str() {
                                        "websocket" => this.child(render_websocket_editor(
                                            &tab,
                                            theme,
                                            entity.clone(),
                                            self.url_input.clone(),
                                            self.composer_input.clone(),
                                        )),
                                        "sse" => this.child(render_sse_editor(
                                            &tab,
                                            theme,
                                            entity.clone(),
                                            self.url_input.clone(),
                                            self.body_input.clone(),
                                        )),
                                        _ => this.child(render_request_editor(
                                            &tab,
                                            theme,
                                            entity.clone(),
                                            self.url_input.clone(),
                                            self.body_input.clone(),
                                        )),
                                    }
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
                                })
                        }
                    )
                    // Bottom Embedded Terminal Panel
                    .child(render_terminal_panel(&self.terminal_state, theme, entity.clone())),
            )
            // Command Palette / Quick Open Modal Overlay
            .child(render_command_palette(&self.picker_state, theme, entity.clone(), self.picker_input.clone()))
            // Code Snippet Generator Modal Overlay
            .child(render_snippet_modal(&self.snippet_modal_state, self.state.active_tab(), theme, entity.clone()))
            // Manage Master Key Modal Overlay
            .child(render_manage_key_modal(&self.env_state, &self.vault_state, theme, entity.clone(), self.vault_input.clone()))
            // Secrets Vault Unlock Dialog Overlay
            .child(render_vault_dialog(&self.vault_state, theme, entity.clone(), self.vault_input.clone()))
            // Conflict Resolution Modal Overlay
            .child(render_conflict_resolver(&self.git_state, theme, entity.clone(), self.conflict_editor.clone()))
            // Settings Modal Overlay
            .child(render_settings_modal(&self.settings_modal_state, theme, entity.clone(), self.proxy_input.clone()))
            // About Modal Overlay
            .child(render_about_modal(self.about_modal_open, theme, entity.clone()))
            // Unsaved Changes Confirmation Modal Overlay
            .child(render_unsaved_modal(&self.unsaved_modal_state, theme, entity.clone()))
            // Floating Right-Click Context Menu Overlay
            .child(render_context_menu(&self.context_menu_state, theme, entity.clone()))
            // Toast Notification Stack (Bottom-Right)
            .child(render_notifications(&self.notification_state, theme, entity))
    }
}
