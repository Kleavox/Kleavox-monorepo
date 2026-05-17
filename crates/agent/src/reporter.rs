// crates/agent/src/reporter.rs

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct CheckReport {
    pub check_id: String,
    pub status: String,
    pub response_ms: Option<u32>,
}

#[derive(Serialize)]
pub struct RegisterCheck {
    pub name: String,
    pub url: String,
    pub node_name: String,
}

#[derive(Deserialize)]
pub struct RegisteredCheck {
    pub id: String,
}

pub struct Reporter {
    client: reqwest::Client,
    api_url: String,
    api_key: String,
}

impl Reporter {
    pub fn new(api_url: &str, api_key: &str) -> Self {
        Self {
            client: reqwest::Client::new(),
            api_url: api_url.trim_end_matches('/').to_string(),
            api_key: api_key.to_string(),
        }
    }

    pub async fn register_check(&self, name: &str, url: &str, node_name: &str) -> Result<String> {
        let body = RegisterCheck {
            name: name.to_string(),
            url: url.to_string(),
            node_name: node_name.to_string(),
        };
        let resp = self
            .client
            .post(format!("{}/api/uptime", self.api_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&body)
            .send()
            .await
            .context("Gagal connect ke API")?;

        if !resp.status().is_success() {
            let text = resp.text().await.unwrap_or_default();
            anyhow::bail!("API error: {text}");
        }

        let check: RegisteredCheck = resp.json().await.context("Gagal parse response")?;
        Ok(check.id)
    }

    pub async fn report(&self, report: &CheckReport) -> Result<()> {
        self.client
            .post(format!("{}/api/uptime/report", self.api_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(report)
            .send()
            .await
            .context("Gagal kirim report")?;
        Ok(())
    }
}
