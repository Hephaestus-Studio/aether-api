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

    /// Attempts to unlock the vault by validating passphrase against candidate encrypted secrets.
    pub fn unlock(
        &mut self,
        passphrase_input: &str,
        workspace_salt: Option<&str>,
        candidate_encrypted_secrets: &[String],
    ) -> Result<(), AppError> {
        let passphrase = passphrase_input.trim();
        if passphrase.is_empty() {
            let err = "Master Key or Passphrase cannot be empty".to_string();
            self.error_message = Some(err.clone());
            return Err(AppError::CryptoError(err));
        }

        self.master_key_input = passphrase.to_string();

        // If there are encrypted secrets in the workspace, test decrypting them to verify the key
        if !candidate_encrypted_secrets.is_empty() {
            let mut verified_key = None;
            for secret in candidate_encrypted_secrets {
                if let Ok((_decrypted, key_bytes)) =
                    crypto::decrypt_secret_auto(secret, passphrase, workspace_salt)
                {
                    verified_key = Some(key_bytes);
                    break;
                }
            }

            match verified_key {
                Some(key_bytes) => {
                    self.cached_key_base64 = Some(BASE64.encode(key_bytes));
                    self.is_unlocked = true;
                    self.is_dialog_open = false;
                    self.error_message = None;
                    Ok(())
                }
                None => {
                    let err = "Incorrect Master Key or Passphrase. Decryption failed.".to_string();
                    self.error_message = Some(err.clone());
                    Err(AppError::CryptoError(err))
                }
            }
        } else {
            // No existing secrets yet - derive new key
            let salt_bytes = workspace_salt
                .map(|s| crypto::decode_salt(s))
                .unwrap_or_else(|| b"aether-api-default-salt-v1".to_vec());
            let key_bytes = crypto::derive_key(passphrase, &salt_bytes)?;
            self.cached_key_base64 = Some(BASE64.encode(key_bytes));
            self.is_unlocked = true;
            self.is_dialog_open = false;
            self.error_message = None;
            Ok(())
        }
    }

    /// Locks the vault and clears cached keys in memory.
    pub fn lock(&mut self) {
        self.is_unlocked = false;
        self.cached_key_base64 = None;
        self.master_key_input.clear();
        self.show_password = false;
    }
}
