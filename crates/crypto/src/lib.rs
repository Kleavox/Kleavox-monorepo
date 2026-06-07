use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use hmac::Hmac;
use pbkdf2::pbkdf2;
use rand::{rngs::OsRng, RngCore};
use sha2::Sha256;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn hash_password(password: &str, salt: &str) -> Result<String, JsValue> {
    let salt = SaltString::from_b64(salt).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| JsValue::from_str(&e.to_string()))?
        .to_string();
    Ok(password_hash)
}

#[wasm_bindgen]
pub fn verify_password(password: &str, hash: &str) -> Result<bool, JsValue> {
    let parsed_hash = PasswordHash::new(hash).map_err(|e| JsValue::from_str(&e.to_string()))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

#[wasm_bindgen]
pub fn encrypt_data(data: &[u8], password: &str) -> Result<Vec<u8>, JsValue> {
    let mut salt = [0u8; 16];
    OsRng.fill_bytes(&mut salt);

    let mut key = [0u8; 32];
    let _ = pbkdf2::<Hmac<Sha256>>(password.as_bytes(), &salt, 100_000, &mut key);

    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| JsValue::from_str(&e.to_string()))?;

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, data)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    let mut result = Vec::with_capacity(salt.len() + nonce_bytes.len() + ciphertext.len());
    result.extend_from_slice(&salt);
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);
    Ok(result)
}

#[wasm_bindgen]
pub fn decrypt_data(data: &[u8], password: &str) -> Result<Vec<u8>, JsValue> {
    if data.len() < 28 {
        return Err(JsValue::from_str("Invalid encrypted data length"));
    }

    let salt = &data[0..16];
    let nonce_bytes = &data[16..28];
    let ciphertext = &data[28..];

    let mut key = [0u8; 32];
    let _ = pbkdf2::<Hmac<Sha256>>(password.as_bytes(), salt, 100_000, &mut key);

    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let nonce = Nonce::from_slice(nonce_bytes);

    let decrypted = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    Ok(decrypted)
}
