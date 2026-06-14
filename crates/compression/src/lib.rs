// Dead-code guard: fail the build if anything in this crate becomes unreachable.
#![deny(dead_code)]

use flate2::Compression;
use flate2::write::GzEncoder;
use std::io::Write;
use wasm_bindgen::prelude::*;

const MAX_INPUT_BYTES: usize = 32 * 1024 * 1024;
const SKIPPED_EXTENSIONS: &[&str] = &[
    "7z", "aac", "apk", "avif", "bin", "br", "bz2", "dmg", "docx", "exe", "flac", "gif", "gz",
    "heic", "iso", "jpeg", "jpg", "m4a", "m4v", "mkv", "mov", "mp3", "mp4", "ogg", "opus", "pdf",
    "png", "pptx", "rar", "tgz", "webm", "webp", "xlsx", "xz", "zip", "zst",
];

#[wasm_bindgen]
pub fn max_input_bytes() -> usize {
    MAX_INPUT_BYTES
}

#[wasm_bindgen]
pub fn should_compress(file_name: &str, content_type: &str, size_bytes: usize) -> bool {
    if !(1024..=MAX_INPUT_BYTES).contains(&size_bytes) {
        return false;
    }

    let extension = file_name
        .rsplit_once('.')
        .map(|(_, extension)| extension.to_ascii_lowercase());
    if extension
        .as_deref()
        .is_some_and(|value| SKIPPED_EXTENSIONS.contains(&value))
    {
        return false;
    }

    let media_type = content_type
        .split(';')
        .next()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();

    let is_compressed_media = media_type.starts_with("audio/")
        || media_type.starts_with("image/")
        || media_type.starts_with("video/")
        || media_type == "application/pdf"
        || media_type.contains("zip")
        || media_type.contains("compressed")
        || media_type.contains("tar")
        || media_type.starts_with("application/vnd.openxmlformats-officedocument.");

    !is_compressed_media
}

#[wasm_bindgen]
pub fn gzip_compress(input: &[u8]) -> Result<Vec<u8>, JsValue> {
    if input.len() > MAX_INPUT_BYTES {
        return Err(JsValue::from_str(
            "File exceeds the browser compression limit.",
        ));
    }

    let mut encoder = GzEncoder::new(Vec::new(), Compression::new(6));
    encoder
        .write_all(input)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    encoder
        .finish()
        .map_err(|error| JsValue::from_str(&error.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_already_compressed_formats() {
        assert!(!should_compress("photo.webp", "image/webp", 4096));
        assert!(!should_compress(
            "archive.zip",
            "application/octet-stream",
            4096
        ));
    }

    #[test]
    fn compresses_repetitive_text() {
        let input = vec![b'a'; 16 * 1024];
        let compressed = gzip_compress(&input).unwrap();
        assert!(compressed.len() < input.len() / 10);
    }
}
