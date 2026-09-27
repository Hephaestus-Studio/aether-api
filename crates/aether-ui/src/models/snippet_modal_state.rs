use aether_core::engine::snippet_generator::SnippetLanguage;

#[derive(Debug, Clone, Default)]
pub struct SnippetModalState {
    pub is_open: bool,
    pub selected_language: Option<SnippetLanguage>,
}

impl SnippetModalState {
    pub fn new() -> Self {
        Self {
            is_open: false,
            selected_language: Some(SnippetLanguage::Curl),
        }
    }

    pub fn open(&mut self) {
        self.is_open = true;
    }

    pub fn close(&mut self) {
        self.is_open = false;
    }

    pub fn language(&self) -> SnippetLanguage {
        self.selected_language.unwrap_or(SnippetLanguage::Curl)
    }
}
