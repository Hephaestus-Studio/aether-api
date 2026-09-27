//! Cryptographic engine providing AES-256-GCM authenticated encryption
//! and PBKDF2 key derivation for securing environment secrets.

use crate::errors::AppError;
use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine as _;
use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};

const CIPHER_PREFIX: &str = "enc:aes-gcm:";
const PBKDF2_ROUNDS: u32 = 100_000;
const NONCE_SIZE: usize = 12; // 96 bits for AES-GCM
const KEY_SIZE: usize = 32; // 256 bits

/// Thread-safe in-memory cache for derived keys to prevent re-running 100k PBKDF2 iterations per variable.
static DERIVED_KEY_CACHE: OnceLock<Arc<Mutex<HashMap<(String, Vec<u8>), [u8; KEY_SIZE]>>>> =
    OnceLock::new();

fn get_derived_key_cache() -> &'static Arc<Mutex<HashMap<(String, Vec<u8>), [u8; KEY_SIZE]>>> {
    DERIVED_KEY_CACHE.get_or_init(|| Arc::new(Mutex::new(HashMap::new())))
}

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

    let effective_salt = if salt.is_empty() {
        b"aether-api-default-salt-v1"
    } else {
        salt
    };

    let cache_key = (trimmed.to_string(), effective_salt.to_vec());
    let cache = get_derived_key_cache();

    if let Ok(guard) = cache.lock() {
        if let Some(cached_key) = guard.get(&cache_key) {
            return Ok(*cached_key);
        }
    }

    // Otherwise derive key via PBKDF2-HMAC-SHA256
    let mut key = [0u8; KEY_SIZE];
    pbkdf2::pbkdf2_hmac::<sha2::Sha256>(
        trimmed.as_bytes(),
        effective_salt,
        PBKDF2_ROUNDS,
        &mut key,
    );

    if let Ok(mut guard) = cache.lock() {
        // Keep cache bounded to avoid unbounded RAM usage
        if guard.len() > 64 {
            guard.clear();
        }
        guard.insert(cache_key, key);
    }

    Ok(key)
}

/// Generates a cryptographically secure 256-bit random master key encoded in Base64.
pub fn generate_random_key() -> String {
    let bytes: [u8; KEY_SIZE] = rand::random();
    BASE64.encode(bytes)
}

const SALT_SIZE: usize = 16; // 128 bits for PBKDF2 salt

/// Generates a cryptographically secure random salt encoded in Base64 (16 bytes).
pub fn generate_salt() -> String {
    let bytes: [u8; SALT_SIZE] = rand::random();
    BASE64.encode(bytes)
}

/// Derives a key using PBKDF2 with the specified explicit salt.
pub fn derive_key_with_salt(key_input: &str, salt: &[u8]) -> Result<[u8; KEY_SIZE], AppError> {
    let trimmed = key_input.trim();
    if trimmed.is_empty() {
        return Err(AppError::CryptoError(
            "Master key cannot be empty".to_string(),
        ));
    }

    let cache_key = (trimmed.to_string(), salt.to_vec());
    let cache = get_derived_key_cache();

    if let Ok(guard) = cache.lock() {
        if let Some(cached_key) = guard.get(&cache_key) {
            return Ok(*cached_key);
        }
    }

    let mut key = [0u8; KEY_SIZE];
    pbkdf2::pbkdf2_hmac::<sha2::Sha256>(trimmed.as_bytes(), salt, PBKDF2_ROUNDS, &mut key);

    if let Ok(mut guard) = cache.lock() {
        if guard.len() > 64 {
            guard.clear();
        }
        guard.insert(cache_key, key);
    }

    Ok(key)
}

/// Decodes a Base64 salt string to bytes, or returns a default domain salt if decoding fails or is empty.
pub fn decode_salt(salt_str: &str) -> Vec<u8> {
    let trimmed = salt_str.trim();
    if trimmed.is_empty() {
        return b"aether-api-default-salt-v1".to_vec();
    }
    BASE64
        .decode(trimmed)
        .unwrap_or_else(|_| trimmed.as_bytes().to_vec())
}

/// Checks whether a given string is in the encrypted format `enc:aes-gcm:...`.
pub fn is_encrypted(value: &str) -> bool {
    value.starts_with(CIPHER_PREFIX)
}

/// Decrypts ciphertext directly using 32-byte AES-256 key bytes.
pub fn decrypt_secret_raw(
    encrypted_str: &str,
    key_bytes: &[u8; KEY_SIZE],
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

    let cipher = Aes256Gcm::new_from_slice(key_bytes)
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

/// Automatically decrypts an encrypted string by testing candidate key derivations and candidate salts.
///
/// Returns `Ok((plaintext, derived_key_bytes))` if successful.
pub fn decrypt_secret_auto(
    encrypted_str: &str,
    key_or_passphrase: &str,
    workspace_salt: Option<&str>,
) -> Result<(String, [u8; KEY_SIZE]), AppError> {
    let trimmed = key_or_passphrase.trim();
    if trimmed.is_empty() {
        return Err(AppError::CryptoError(
            "Master key or passphrase cannot be empty".to_string(),
        ));
    }

    // 1. If input is valid 32-byte Base64, try direct raw key decryption first
    if let Ok(decoded) = BASE64.decode(trimmed) {
        if decoded.len() == KEY_SIZE {
            let mut key = [0u8; KEY_SIZE];
            key.copy_from_slice(&decoded);
            if let Ok(decrypted) = decrypt_secret_raw(encrypted_str, &key) {
                return Ok((decrypted, key));
            }
        }
    }

    // 2. Build candidate salts
    let mut candidate_salts: Vec<Vec<u8>> = Vec::new();

    if let Some(ws_salt) = workspace_salt {
        let decoded = decode_salt(ws_salt);
        if !candidate_salts.contains(&decoded) {
            candidate_salts.push(decoded);
        }
        let raw = ws_salt.as_bytes().to_vec();
        if !candidate_salts.contains(&raw) {
            candidate_salts.push(raw);
        }
    }

    let default_salt = b"aether-api-default-salt-v1".to_vec();
    if !candidate_salts.contains(&default_salt) {
        candidate_salts.push(default_salt);
    }

    let empty_salt = b"".to_vec();
    if !candidate_salts.contains(&empty_salt) {
        candidate_salts.push(empty_salt);
    }

    let legacy_salts: &[&[u8]] = &[b"aether-api-v1", b"default_salt", b"aether", b"aether-api"];
    for &ls in legacy_salts {
        let ls_vec = ls.to_vec();
        if !candidate_salts.contains(&ls_vec) {
            candidate_salts.push(ls_vec);
        }
    }

    // 3. Try each candidate salt with PBKDF2
    for salt in &candidate_salts {
        if let Ok(derived) = derive_key_with_salt(trimmed, salt) {
            if let Ok(decrypted) = decrypt_secret_raw(encrypted_str, &derived) {
                return Ok((decrypted, derived));
            }
        }
    }

    // 4. Try SHA-256 hash of passphrase directly
    use sha2::Digest;
    let sha_key: [u8; KEY_SIZE] = sha2::Sha256::digest(trimmed.as_bytes()).into();
    if let Ok(decrypted) = decrypt_secret_raw(encrypted_str, &sha_key) {
        return Ok((decrypted, sha_key));
    }

    Err(AppError::CryptoError(
        "Decryption failed: incorrect Master Key or corrupted data".to_string(),
    ))
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
    let salt_opt = if salt.is_empty() {
        None
    } else {
        std::str::from_utf8(salt).ok()
    };
    match decrypt_secret_auto(encrypted_str, key_input, salt_opt) {
        Ok((decrypted, _)) => Ok(decrypted),
        Err(_) => {
            let key_bytes = derive_key(key_input, salt)?;
            decrypt_secret_raw(encrypted_str, &key_bytes)
        }
    }
}

/// Decrypts an encrypted string with a primary salt, and optionally falls back to a legacy salt if primary decryption fails.
pub fn decrypt_secret_with_fallback(
    encrypted_str: &str,
    key_input: &str,
    primary_salt: &[u8],
    fallback_salt: Option<&[u8]>,
) -> Result<String, AppError> {
    let primary_salt_str = std::str::from_utf8(primary_salt).ok();
    if let Ok((decrypted, _)) = decrypt_secret_auto(encrypted_str, key_input, primary_salt_str) {
        return Ok(decrypted);
    }
    if let Some(fallback) = fallback_salt {
        let fallback_salt_str = std::str::from_utf8(fallback).ok();
        if let Ok((decrypted, _)) = decrypt_secret_auto(encrypted_str, key_input, fallback_salt_str)
        {
            return Ok(decrypted);
        }
    }
    decrypt_secret(encrypted_str, key_input, primary_salt)
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

        // Corrupt a character inside the payload
        let mut chars: Vec<char> = encrypted.chars().collect();
        let target_idx = chars.len().saturating_sub(6);
        chars[target_idx] = if chars[target_idx] == 'A' { 'B' } else { 'A' };
        let corrupted: String = chars.into_iter().collect();

        let result = decrypt_secret(&corrupted, "key-123", salt);
        assert!(result.is_err());
    }

    #[test]
    fn test_generate_salt_and_decode() {
        let salt_b64 = generate_salt();
        let decoded = decode_salt(&salt_b64);
        assert_eq!(decoded.len(), SALT_SIZE);
    }

    #[test]
    fn test_decrypt_with_fallback_success() {
        let legacy_salt = b"legacy_path_salt_123";
        let workspace_salt = decode_salt(&generate_salt());
        let passphrase = "my-test-password";
        let secret = "secret_api_token_value";

        // Encrypted with legacy salt
        let encrypted_legacy = encrypt_secret(secret, passphrase, legacy_salt).unwrap();

        // Attempt decrypt with workspace_salt (should fail if no fallback, but succeed with fallback)
        let decrypted = decrypt_secret_with_fallback(
            &encrypted_legacy,
            passphrase,
            &workspace_salt,
            Some(legacy_salt),
        )
        .unwrap();

        assert_eq!(decrypted, secret);
    }

    #[test]
    fn test_empty_key_fails() {
        let salt = b"salt";
        assert!(encrypt_secret("test", "", salt).is_err());
        assert!(derive_key("   ", salt).is_err());
    }

    #[test]
    fn test_decrypt_secret_auto_all_variations() {
        let raw_secret = "https://httpbin.org";
        let passphrase = "my-secure-master-password";
        let ws_salt = generate_salt();
        let ws_salt_bytes = decode_salt(&ws_salt);

        // 1. Encrypted with decoded workspace salt
        let enc1 = encrypt_secret(raw_secret, passphrase, &ws_salt_bytes).unwrap();
        let (dec1, _) = decrypt_secret_auto(&enc1, passphrase, Some(&ws_salt)).unwrap();
        assert_eq!(dec1, raw_secret);

        // 2. Encrypted with raw salt string bytes
        let enc2 = encrypt_secret(raw_secret, passphrase, ws_salt.as_bytes()).unwrap();
        let (dec2, _) = decrypt_secret_auto(&enc2, passphrase, Some(&ws_salt)).unwrap();
        assert_eq!(dec2, raw_secret);

        // 3. Encrypted with default salt
        let enc3 = encrypt_secret(raw_secret, passphrase, b"aether-api-default-salt-v1").unwrap();
        let (dec3, _) = decrypt_secret_auto(&enc3, passphrase, None).unwrap();
        assert_eq!(dec3, raw_secret);

        // 4. Encrypted with empty salt
        let enc4 = encrypt_secret(raw_secret, passphrase, b"").unwrap();
        let (dec4, _) = decrypt_secret_auto(&enc4, passphrase, Some(&ws_salt)).unwrap();
        assert_eq!(dec4, raw_secret);

        // 5. Encrypted with 32-byte direct base64 key
        let direct_key = generate_random_key();
        let enc5 = encrypt_secret(raw_secret, &direct_key, &[]).unwrap();
        let (dec5, _) = decrypt_secret_auto(&enc5, &direct_key, None).unwrap();
        assert_eq!(dec5, raw_secret);
    }
}
