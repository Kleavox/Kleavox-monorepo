// crates/agent/src/config.rs

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub node_name: String,
    pub api_url: String,
    pub api_key: String,
    pub interval_minutes: u64,
    #[serde(default)]
    pub metrics: MetricsConfig,
    #[serde(default)]
    pub checks: Vec<CheckConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MetricsConfig {
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckConfig {
    pub id: String,
    pub name: String,
    pub url: String,
}

impl Config {
    pub fn path() -> PathBuf {
        if let Some(base) = dirs::config_dir() {
            base.join("deauboard-agent").join("config.toml")
        } else {
            PathBuf::from("/etc/deauboard-agent/config.toml")
        }
    }

    pub fn load() -> Result<Self> {
        let path = Self::path();
        let content = std::fs::read_to_string(&path)
            .with_context(|| format!("Config tidak ditemukan di {}", path.display()))?;
        toml::from_str(&content).context("Gagal parse config")
    }

    pub fn save(&self) -> Result<()> {
        let path = Self::path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let content = toml::to_string_pretty(self)?;
        std::fs::write(&path, content)?;
        Ok(())
    }
}
