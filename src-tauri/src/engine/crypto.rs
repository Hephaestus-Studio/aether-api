//! Cryptographic engine providing AES-256-GCM authenticated encryption
//! and PBKDF2 key derivation for securing environment secrets.

use crate::errors::AppError;
use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine as _;

const CIPHER_PREFIX: &str = "enc:aes-gcm:";
const PBKDF2_ROUNDS: u32 = 100_000;
const NONCE_SIZE: usize = 12; // 96 bits for AES-GCM
const KEY_SIZE: usize = 32; // 256 bits

/// Derives a 256-bit AES key from either a 32-byte Base64 key or an arbitrary passphrase.
pub fn derive_key(key_input: &str, salt: &[u8]) -> Result<[u8; KEY_SIZE], AppError> {
    let trimmed = key_input.trim();
    if trimmed.is_empty() {
        return Err(AppError::CryptoError(
            "Master key cannot be empty".to_string(),
        ));
    }

    // If key_input is valid base64 decoding to exactly 32 bytes, use it directly as raw key
    if let Ok(decoded) = BASE64.decode(trimmed) {
        if decoded.len() == KEY_SIZE {
            let mut key = [0u8; KEY_SIZE];
            key.copy_from_slice(&decoded);
            return Ok(key);
        }
    }

    // Otherwise derive key via PBKDF2-HMAC-SHA256
    let mut key = [0u8; KEY_SIZE];
    let effective_salt = if salt.is_empty() {
        b"aether-api-default-salt-v1"
    } else {
        salt
    };

    pbkdf2::pbkdf2_hmac::<sha2::Sha256>(
        trimmed.as_bytes(),
        effective_salt,
        PBKDF2_ROUNDS,
        &mut key,
    );

    Ok(key)
}

/// Generates a cryptographically secure 256-bit random master key encoded in Base64.
pub fn generate_random_key() -> String {
    let bytes: [u8; KEY_SIZE] = rand::random();
    BASE64.encode(bytes)
}

/// Checks whether a given string is in the encrypted format `enc:aes-gcm:...`.
pub fn is_encrypted(value: &str) -> bool {
    value.starts_with(CIPHER_PREFIX)
}

/// Encrypts a plaintext string using AES-256-GCM with the provided Master Key and workspace salt.
///
/// Returns format: `enc:aes-gcm:<base64_nonce>:<base64_ciphertext_with_tag>`
pub fn encrypt_secret(plaintext: &str, key_input: &str, salt: &[u8]) -> Result<String, AppError> {
    let key_bytes = derive_key(key_input, salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key_bytes)
        .map_err(|e| AppError::CryptoError(format!("Failed to initialize cipher: {}", e)))?;

    let nonce_bytes: [u8; NONCE_SIZE] = rand::random();
    let nonce = Nonce::from(nonce_bytes);

    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_bytes())
        .map_err(|e| AppError::CryptoError(format!("Encryption failed: {}", e)))?;

    let nonce_b64 = BASE64.encode(nonce_bytes);
    let ciphertext_b64 = BASE64.encode(ciphertext);

    Ok(format!("{}{}:{}", CIPHER_PREFIX, nonce_b64, ciphertext_b64))
}

/// Decrypts an encrypted string (`enc:aes-gcm:<nonce>:<ciphertext>`) using AES-256-GCM.
pub fn decrypt_secret(
    encrypted_str: &str,
    key_input: &str,
    salt: &[u8],
) -> Result<String, AppError> {
    if !encrypted_str.starts_with(CIPHER_PREFIX) {
        return Err(AppError::CryptoError(
            "Value is not in encrypted format (missing enc:aes-gcm: prefix)".to_string(),
        ));
    }

    let payload = &encrypted_str[CIPHER_PREFIX.len()..];
    let parts: Vec<&str> = payload.split(':').collect();
    if parts.len() != 2 {
        return Err(AppError::CryptoError(
            "Invalid encrypted payload format, expected nonce:ciphertext".to_string(),
        ));
    }

    let nonce_bytes = BASE64
        .decode(parts[0])
        .map_err(|e| AppError::CryptoError(format!("Invalid base64 nonce: {}", e)))?;
    if nonce_bytes.len() != NONCE_SIZE {
        return Err(AppError::CryptoError(format!(
            "Invalid nonce length: expected {}, got {}",
            NONCE_SIZE,
            nonce_bytes.len()
        )));
    }

    let ciphertext_bytes = BASE64
        .decode(parts[1])
        .map_err(|e| AppError::CryptoError(format!("Invalid base64 ciphertext: {}", e)))?;

    let key_bytes = derive_key(key_input, salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key_bytes)
        .map_err(|e| AppError::CryptoError(format!("Failed to initialize cipher: {}", e)))?;

    let mut fixed_nonce = [0u8; NONCE_SIZE];
    fixed_nonce.copy_from_slice(&nonce_bytes);
    let nonce = Nonce::from(fixed_nonce);

    let decrypted_bytes = cipher
        .decrypt(&nonce, ciphertext_bytes.as_ref())
        .map_err(|_| {
            AppError::CryptoError(
                "Decryption failed: incorrect Master Key or corrupted data".to_string(),
            )
        })?;

    String::from_utf8(decrypted_bytes)
        .map_err(|e| AppError::CryptoError(format!("Decrypted data is not valid UTF-8: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_random_key() {
        let key = generate_random_key();
        let decoded = BASE64.decode(&key).unwrap();
        assert_eq!(decoded.len(), KEY_SIZE);
    }

    #[test]
    fn test_derive_key_direct_base64_vs_passphrase() {
        let raw_key = generate_random_key();
        let salt = b"workspace-salt-123";
        let derived1 = derive_key(&raw_key, salt).unwrap();
        let decoded = BASE64.decode(&raw_key).unwrap();
        assert_eq!(derived1, decoded.as_slice());

        let passphrase = "my-secret-passphrase-2026";
        let derived2 = derive_key(passphrase, salt).unwrap();
        assert_eq!(derived2.len(), KEY_SIZE);
        assert_ne!(derived1, derived2);
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip_passphrase() {
        let salt = b"my_workspace_path";
        let passphrase = "super-secret-password-123!";
        let secret = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";

        let encrypted = encrypt_secret(secret, passphrase, salt).unwrap();
        assert!(is_encrypted(&encrypted));
        assert_ne!(encrypted, secret);

        let decrypted = decrypt_secret(&encrypted, passphrase, salt).unwrap();
        assert_eq!(decrypted, secret);
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip_random_key() {
        let salt = b"workspace-abc";
        let master_key = generate_random_key();
        let secret = "postgresql://user:pass@localhost:5432/mydb";

        let encrypted = encrypt_secret(secret, &master_key, salt).unwrap();
        assert!(is_encrypted(&encrypted));

        let decrypted = decrypt_secret(&encrypted, &master_key, salt).unwrap();
        assert_eq!(decrypted, secret);
    }

    #[test]
    fn test_decrypt_with_wrong_key_fails() {
        let salt = b"workspace-salt";
        let secret = "my_api_key_secret";
        let encrypted = encrypt_secret(secret, "correct-key-123", salt).unwrap();

        let result = decrypt_secret(&encrypted, "wrong-key-456", salt);
        assert!(result.is_err());
    }

    #[test]
    fn test_decrypt_corrupted_ciphertext_fails() {
        let salt = b"workspace-salt";
        let secret = "test-secret";
        let encrypted = encrypt_secret(secret, "key-123", salt).unwrap();

        // Corrupt ciphertext
        let mut corrupted = encrypted.clone();
        corrupted.pop();
        corrupted.push('X');

        let result = decrypt_secret(&corrupted, "key-123", salt);
        assert!(result.is_err());
    }

    #[test]
    fn test_empty_key_fails() {
        let salt = b"salt";
        assert!(encrypt_secret("test", "", salt).is_err());
        assert!(derive_key("   ", salt).is_err());
    }
}
