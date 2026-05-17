// crates/agent/src/checker.rs

use anyhow::Result;
use std::time::Instant;

pub struct CheckResult {
    pub status: &'static str,
    pub response_ms: Option<u32>,
}

pub async fn check_url(url: &str) -> CheckResult {
    if url.starts_with("tcp://") {
        let addr = url.strip_prefix("tcp://").unwrap_or(url);
        let mut parts = addr.splitn(2, ':');
        let host = parts.next().unwrap_or("localhost");
        let port = parts.next().and_then(|p| p.parse::<u16>().ok()).unwrap_or(80);
        let is_up = check_tcp(host, port).await.unwrap_or(false);
        return CheckResult {
            status: if is_up { "up" } else { "down" },
            response_ms: None,
        };
    }
    check_http(url).await
}

async fn check_http(url: &str) -> CheckResult {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .danger_accept_invalid_certs(true)
        .build()
        .unwrap();

    let start = Instant::now();
    match client.get(url).send().await {
        Ok(resp) if resp.status().is_success() || resp.status().as_u16() < 500 => CheckResult {
            status: "up",
            response_ms: Some(start.elapsed().as_millis() as u32),
        },
        _ => CheckResult {
            status: "down",
            response_ms: None,
        },
    }
}

pub async fn check_tcp(host: &str, port: u16) -> Result<bool> {
    let addr = format!("{host}:{port}");
    let result = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        tokio::net::TcpStream::connect(&addr),
    )
    .await;
    Ok(matches!(result, Ok(Ok(_))))
}
