use aether_core::engine::terminal_pty::{PtyManager, PtySession};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::mpsc::unbounded_channel;

/// Represents an active Terminal tab with its PTY session and buffer.
#[derive(Clone)]
pub struct TerminalTab {
    pub id: String,
    pub title: String,
    pub pty_session: Arc<PtySession>,
    pub output_lines: Vec<String>,
}

/// Global reactive state for embedded terminal tabs in the bottom panel.
#[derive(Clone, Default)]
pub struct TerminalState {
    pub is_visible: bool,
    pub tabs: Vec<TerminalTab>,
    pub active_tab_index: usize,
    pub pty_manager: Arc<PtyManager>,
    pub current_input: String,
}

impl TerminalState {
    pub fn new() -> Self {
        Self {
            is_visible: false,
            tabs: Vec::new(),
            active_tab_index: 0,
            pty_manager: Arc::new(PtyManager::new()),
            current_input: String::new(),
        }
    }

    /// Spawns a new terminal session and tab.
    pub fn create_tab(
        &mut self,
        cwd: Option<PathBuf>,
    ) -> Option<tokio::sync::mpsc::UnboundedReceiver<Vec<u8>>> {
        let (tx, rx) = unbounded_channel();
        let tab_num = self.tabs.len() + 1;
        let id = format!("term-{}", tab_num);
        let title = format!("Terminal {}", tab_num);

        if let Ok(session) =
            self.pty_manager
                .create_session(id.clone(), title.clone(), cwd, 80, 24, tx)
        {
            self.tabs.push(TerminalTab {
                id,
                title,
                pty_session: session,
                output_lines: vec![
                    "Welcome to Aether API Terminal. Type commands and press Enter.".to_string(),
                ],
            });
            self.active_tab_index = self.tabs.len() - 1;
            self.is_visible = true;
            Some(rx)
        } else {
            None
        }
    }

    /// Appends output chunks into active terminal lines.
    pub fn append_output(&mut self, tab_id: &str, text: &str) {
        if let Some(tab) = self.tabs.iter_mut().find(|t| t.id == tab_id) {
            for line in text.lines() {
                tab.output_lines.push(line.to_string());
            }
            if tab.output_lines.len() > 1000 {
                tab.output_lines.drain(0..tab.output_lines.len() - 1000);
            }
        }
    }

    /// Sends input line to the active terminal.
    pub fn send_input(&mut self, input: &str) {
        if let Some(tab) = self.tabs.get(self.active_tab_index) {
            let mut payload = input.as_bytes().to_vec();
            payload.push(b'\n');
            let _ = tab.pty_session.write_input(&payload);
        }
        self.current_input.clear();
    }

    /// Closes a terminal tab.
    pub fn close_tab(&mut self, index: usize) {
        if index < self.tabs.len() {
            let tab = self.tabs.remove(index);
            self.pty_manager.close_session(&tab.id);
            if self.active_tab_index >= self.tabs.len() && !self.tabs.is_empty() {
                self.active_tab_index = self.tabs.len() - 1;
            }
            if self.tabs.is_empty() {
                self.is_visible = false;
            }
        }
    }

    pub fn toggle_visibility(&mut self) {
        self.is_visible = !self.is_visible;
    }

    pub fn active_tab(&self) -> Option<&TerminalTab> {
        self.tabs.get(self.active_tab_index)
    }
}
