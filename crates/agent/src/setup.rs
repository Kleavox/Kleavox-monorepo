// crates/agent/src/setup.rs

use crate::config::{CheckConfig, Config, MetricsConfig};
use crate::discovery;
use crate::reporter::Reporter;
use anyhow::Result;
use colored::Colorize;
use dialoguer::{Confirm, Input, MultiSelect, Select};

pub async fn run_setup() -> Result<()> {
    println!("{}", "\nDeauboard Agent Setup".bold());
    println!("{}", "━".repeat(30).dimmed());

    let api_url: String = Input::new()
        .with_prompt("API URL")
        .default("https://board.deau.site".to_string())
        .interact_text()?;

    let api_key: String = Input::new()
        .with_prompt("Agent API Key")
        .interact_text()?;

    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "vps".to_string());

    let node_name: String = Input::new()
        .with_prompt("Nama node (VPS ini)")
        .default(hostname)
        .interact_text()?;

    let interval: u64 = Select::new()
        .with_prompt("Interval check")
        .items(&["5 menit", "15 menit", "30 menit", "1 jam"])
        .default(2)
        .interact()
        .map(|i| [5u64, 15, 30, 60][i])?;

    let metrics_enabled = Confirm::new()
        .with_prompt("Pantau system metrics? (CPU, RAM, Disk)")
        .default(true)
        .interact()?;

    println!("\n{}", "Mencari services yang berjalan...".dimmed());
    let discovered = discovery::discover().await;

    let mut checks = vec![];

    if discovered.is_empty() {
        println!("{}", "Tidak ada service ditemukan otomatis.".yellow());
        if Confirm::new()
            .with_prompt("Tambah service manual?")
            .default(true)
            .interact()?
        {
            checks.extend(add_manual_checks()?);
        }
    } else {
        println!("{} {} services ditemukan:\n", "●".green(), discovered.len());

        let items: Vec<String> = discovered
            .iter()
            .map(|s| format!("{} ({})", s.name, s.url))
            .collect();

        let selected = MultiSelect::new()
            .with_prompt("Pilih services yang dipantau (space = toggle, enter = konfirmasi)")
            .items(&items)
            .interact()?;

        for i in selected {
            checks.push((discovered[i].name.clone(), discovered[i].url.clone()));
        }

        if Confirm::new()
            .with_prompt("Tambah service manual lainnya?")
            .default(false)
            .interact()?
        {
            checks.extend(add_manual_checks()?);
        }
    }

    println!("\n{}", "Mendaftarkan checks ke Deauboard...".dimmed());
    let reporter = Reporter::new(&api_url, &api_key);
    let mut check_configs = vec![];

    for (name, url) in &checks {
        print!("  Mendaftarkan {}... ", name.cyan());
        match reporter.register_check(name, url, &node_name).await {
            Ok(id) => {
                println!("{}", "✓".green());
                check_configs.push(CheckConfig { id, name: name.clone(), url: url.clone() });
            }
            Err(e) => {
                println!("{} {}", "✗".red(), e.to_string().dimmed());
            }
        }
    }

    let config = Config {
        node_name,
        api_url,
        api_key,
        interval_minutes: interval,
        metrics: MetricsConfig { enabled: metrics_enabled },
        checks: check_configs,
    };

    config.save()?;
    println!("\n{} Config tersimpan di {}", "✓".green().bold(), Config::path().display());
    println!(
        "  Jalankan: {} atau {}",
        "deauboard-agent run".cyan(),
        "deauboard-agent install-service".cyan()
    );

    Ok(())
}

pub async fn run_edit() -> Result<()> {
    let mut config = crate::config::Config::load()?;
    let reporter = Reporter::new(&config.api_url, &config.api_key);

    println!("{}", "\nDeauboard Agent — Edit Config".bold());
    println!("{}", "━".repeat(30).dimmed());

    loop {
        let options = vec![
            "Tambah service baru",
            "Hapus service",
            "Scan ulang services",
            "Ubah interval",
            "Selesai",
        ];

        let choice = Select::new()
            .with_prompt("Pilih aksi")
            .items(&options)
            .interact()?;

        match choice {
            0 => {
                let new_checks = add_manual_checks()?;
                for (name, url) in new_checks {
                    print!("  Mendaftarkan {}... ", name.cyan());
                    match reporter.register_check(&name, &url, &config.node_name).await {
                        Ok(id) => {
                            println!("{}", "✓".green());
                            config.checks.push(crate::config::CheckConfig { id, name, url });
                        }
                        Err(e) => println!("{} {}", "✗".red(), e.to_string().dimmed()),
                    }
                }
            }
            1 => {
                if config.checks.is_empty() {
                    println!("{}", "Tidak ada service untuk dihapus.".yellow());
                } else {
                    let items: Vec<String> = config.checks.iter()
                        .map(|c| format!("{} ({})", c.name, c.url))
                        .collect();
                    let selected = MultiSelect::new()
                        .with_prompt("Pilih service yang dihapus")
                        .items(&items)
                        .interact()?;
                    for i in selected.into_iter().rev() {
                        let removed = config.checks.remove(i);
                        println!("{} {} dihapus dari config", "✓".green(), removed.name);
                    }
                }
            }
            2 => {
                println!("{}", "Mencari services...".dimmed());
                let discovered = discovery::discover().await;
                if !discovered.is_empty() {
                    let items: Vec<String> = discovered.iter()
                        .map(|s| format!("{} ({})", s.name, s.url))
                        .collect();
                    let selected = MultiSelect::new()
                        .with_prompt("Pilih services untuk ditambahkan")
                        .items(&items)
                        .interact()?;
                    for i in selected {
                        let s = &discovered[i];
                        match reporter.register_check(&s.name, &s.url, &config.node_name).await {
                            Ok(id) => {
                                config.checks.push(crate::config::CheckConfig {
                                    id,
                                    name: s.name.clone(),
                                    url: s.url.clone(),
                                });
                                println!("{} {} ditambahkan", "✓".green(), s.name.cyan());
                            }
                            Err(e) => println!("{} {}", "✗".red(), e),
                        }
                    }
                } else {
                    println!("{}", "Tidak ada service baru ditemukan.".yellow());
                }
            }
            3 => {
                let interval: u64 = Select::new()
                    .with_prompt("Interval check")
                    .items(&["5 menit", "15 menit", "30 menit", "1 jam"])
                    .default(match config.interval_minutes {
                        5 => 0, 15 => 1, 60 => 3, _ => 2,
                    })
                    .interact()
                    .map(|i| [5u64, 15, 30, 60][i])?;
                config.interval_minutes = interval;
            }
            _ => break,
        }

        config.save()?;
        println!("{}", "Config tersimpan.".dimmed());
    }

    Ok(())
}

fn add_manual_checks() -> Result<Vec<(String, String)>> {
    let mut checks = vec![];
    loop {
        let name: String = Input::new()
            .with_prompt("Nama service")
            .interact_text()?;
        let url: String = Input::new()
            .with_prompt("URL (misal: http://localhost:3000)")
            .interact_text()?;
        checks.push((name, url));

        if !Confirm::new()
            .with_prompt("Tambah lagi?")
            .default(false)
            .interact()?
        {
            break;
        }
    }
    Ok(checks)
}
