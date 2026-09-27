#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PickerMode {
    QuickOpen,      // Ctrl+P: Fuzzy search requests
    CommandPalette, // Ctrl+K: Execute actions
}

#[derive(Debug, Clone)]
pub struct PickerItem {
    pub id: String,
    pub title: String,
    pub subtitle: Option<String>,
    pub badge: Option<String>,
    pub shortcut: Option<String>,
}

/// Reactive state for Quick Open / Command Palette picker modal.
#[derive(Debug, Clone, Default)]
pub struct PickerState {
    pub is_open: bool,
    pub mode: Option<PickerMode>,
    pub query: String,
    pub items: Vec<PickerItem>,
    pub selected_index: usize,
}

impl PickerState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn open_quick_open(&mut self, items: Vec<PickerItem>) {
        self.is_open = true;
        self.mode = Some(PickerMode::QuickOpen);
        self.query.clear();
        self.items = items;
        self.selected_index = 0;
    }

    pub fn open_command_palette(&mut self, items: Vec<PickerItem>) {
        self.is_open = true;
        self.mode = Some(PickerMode::CommandPalette);
        self.query.clear();
        self.items = items;
        self.selected_index = 0;
    }

    pub fn close(&mut self) {
        self.is_open = false;
        self.mode = None;
        self.query.clear();
        self.items.clear();
        self.selected_index = 0;
    }

    pub fn filtered_items(&self) -> Vec<&PickerItem> {
        if self.query.trim().is_empty() {
            return self.items.iter().collect();
        }
        let q = self.query.to_lowercase();
        self.items
            .iter()
            .filter(|item| {
                item.title.to_lowercase().contains(&q)
                    || item
                        .subtitle
                        .as_deref()
                        .unwrap_or("")
                        .to_lowercase()
                        .contains(&q)
            })
            .collect()
    }

    pub fn select_next(&mut self) {
        let count = self.filtered_items().len();
        if count > 0 {
            self.selected_index = (self.selected_index + 1) % count;
        }
    }

    pub fn select_prev(&mut self) {
        let count = self.filtered_items().len();
        if count > 0 {
            if self.selected_index == 0 {
                self.selected_index = count - 1;
            } else {
                self.selected_index -= 1;
            }
        }
    }

    pub fn selected_item(&self) -> Option<&PickerItem> {
        let filtered = self.filtered_items();
        filtered.get(self.selected_index).copied()
    }
}
