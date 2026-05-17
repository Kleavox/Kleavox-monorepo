// crates/agent/src/main.rs

mod checker;
mod config;
mod discovery;
mod metrics;
mod reporter;
mod setup;

use anyhow::Result;
use clap::{Parser, Subcommand};
use colored::Colorize;
use reporter::{CheckReport, Reporter};
use std::time::Duration;
use tokio::time;

#[derive(Parser)]
#[command(name = "deau", about = "Deauboard monitoring agent")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    Setup,
    Run,
    InstallService,
    Uninstall,
    Edit,
    Status,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Command::Setup => setup::run_setup().await?,
        Command::Run => run_monitor().await?,
        Command::InstallService => install_service()?,
        Command::Uninstall => uninstall()?,
        Command::Edit => setup::run_edit().await?,
        Command::Status => show_status()?,
    }
    Ok(())
}

async fn run_monitor() -> Result<()> {
    let config = config::Config::load()?;
    let reporter = Reporter::new(&config.api_url, &config.api_key);
    let interval = Duration::from_secs(config.interval_minutes * 60);

    println!(
        "{} Deauboard Agent mulai — {} checks, interval {} menit",
        "●".green().bold(),
        config.checks.len(),
        config.interval_minutes
    );

    loop {
        println!("\n{}", "Menjalankan checks...".dimmed());

        for check in &config.checks {
            let result = checker::check_http(&check.url).await;
            let status_icon = if result.status == "up" { "✓".green() } else { "✗".red() };
            println!(
                "  {} {} — {}{}",
                status_icon,
                check.name.cyan(),
                result.status,
                result.response_ms.map(|ms| format!(" ({ms}ms)")).unwrap_or_default().dimmed()
            );

            let report = CheckReport {
                check_id: check.id.clone(),
                status: result.status.to_string(),
                response_ms: result.response_ms,
            };
            if let Err(e) = reporter.report(&report).await {
                eprintln!("  {} Gagal kirim report: {e}", "!".yellow());
            }
        }

        if config.metrics.enabled {
            let m = metrics::collect();
            println!(
                "  {} CPU: {:.1}% | RAM: {:.1}% | Disk: {:.1}%",
                "📊".normal(),
                m.cpu_percent,
                m.ram_percent,
                m.disk_percent
            );
        }

        println!("{}", format!("  Berikutnya dalam {} menit...", config.interval_minutes).dimmed());
        time::sleep(interval).await;
    }
}

fn install_service() -> Result<()> {
    let bin_path = std::env::current_exe()?;
    let service = format!(
        r#"[Unit]
Description=Deauboard Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart={} run
Restart=always
RestartSec=30
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
"#,
        bin_path.display()
    );

    std::fs::write("/etc/systemd/system/deau.service", service)?;
    println!("{} Service file dibuat.", "✓".green());
    println!("Jalankan:");
    println!("  {}", "sudo systemctl daemon-reload".cyan());
    println!("  {}", "sudo systemctl enable --now deau".cyan());
    println!("  {}", "sudo journalctl -fu deau".cyan());
    Ok(())
}

fn uninstall() -> Result<()> {
    use dialoguer::Confirm;

    println!("{}", "Deauboard Agent Uninstall".bold());

    let service_path = std::path::Path::new("/etc/systemd/system/deau.service");
    if service_path.exists() {
        println!("Menghentikan dan menonaktifkan service...");
        let _ = std::process::Command::new("systemctl").args(["stop", "deau"]).status();
        let _ = std::process::Command::new("systemctl").args(["disable", "deau"]).status();
        std::fs::remove_file(service_path)?;
        let _ = std::process::Command::new("systemctl").arg("daemon-reload").status();
        println!("{} Service dihapus.", "✓".green());
    } else {
        println!("{}", "Service tidak ditemukan (skip).".dimmed());
    }

    let config_path = config::Config::path();
    if config_path.exists() {
        if Confirm::new()
            .with_prompt("Hapus config juga?")
            .default(false)
            .interact()?
        {
            std::fs::remove_file(&config_path)?;
            println!("{} Config dihapus.", "✓".green());
        }
    }

    println!("{} Uninstall selesai.", "✓".green().bold());
    Ok(())
}

fn show_status() -> Result<()> {
    let config = config::Config::load()?;
    println!("{}", "Deauboard Agent Status".bold());
    println!("  Node     : {}", config.node_name.cyan());
    println!("  API      : {}", config.api_url.dimmed());
    println!("  Interval : {} menit", config.interval_minutes);
    println!("  Metrics  : {}", if config.metrics.enabled { "aktif".green() } else { "nonaktif".dimmed() });
    println!("  Checks   : {}", config.checks.len());
    for c in &config.checks {
        println!("    - {} ({})", c.name.cyan(), c.url.dimmed());
    }
    Ok(())
}

