use aether_core::engine::crypto;
use aether_core::errors::AppError;
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;

/// Reactive state for Secrets Vault (AES-256-GCM encryption for environment variables).
#[derive(Debug, Clone, Default)]
pub struct VaultState {
    pub is_unlocked: bool,
    pub is_dialog_open: bool,
    pub master_key_input: String,
    pub show_password: bool,
    pub error_message: Option<String>,
    pub cached_key_base64: Option<String>,
}

impl VaultState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn open_dialog(&mut self) {
        self.is_dialog_open = true;
        self.master_key_input.clear();
        self.show_password = false;
        self.error_message = None;
    }

    pub fn close_dialog(&mut self) {
        self.is_dialog_open = false;
        self.master_key_input.clear();
        self.show_password = false;
        self.error_message = None;
    }

    pub fn toggle_show_password(&mut self) {
        self.show_password = !self.show_password;
    }

    pub fn set_master_key_input(&mut self, input: String) {
        self.master_key_input = input;
        self.error_message = None;
    }

    /// Attempts to unlock the vault by deriving the AES-256 key from passphrase + salt.
    pub fn unlock(&mut self, salt: Option<&str>) -> Result<(), AppError> {
        let passphrase = self.master_key_input.trim();
        let salt_bytes = salt.map(|s| s.as_bytes()).unwrap_or(b"");

        let key_bytes = crypto::derive_key(
            if passphrase.is_empty() {
                "default-master-key"
            } else {
                passphrase
            },
            salt_bytes,
        )?;
        let key_base64 = BASE64.encode(key_bytes);
        self.cached_key_base64 = Some(key_base64);
        self.is_unlocked = true;
        self.is_dialog_open = false;
        self.error_message = None;
        Ok(())
    }

    /// Locks the vault and clears cached keys in memory.
    pub fn lock(&mut self) {
        self.is_unlocked = false;
        self.cached_key_base64 = None;
        self.master_key_input.clear();
        self.show_password = false;
    }
}
