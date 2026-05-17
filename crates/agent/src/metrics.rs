// crates/agent/src/metrics.rs

use serde::Serialize;
use sysinfo::{Disks, System};

#[derive(Debug, Serialize)]
pub struct Metrics {
    pub cpu_percent: f32,
    pub ram_used_mb: u64,
    pub ram_total_mb: u64,
    pub ram_percent: f32,
    pub disk_used_gb: f32,
    pub disk_total_gb: f32,
    pub disk_percent: f32,
}

pub fn collect() -> Metrics {
    let mut sys = System::new_all();
    sys.refresh_all();

    std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
    sys.refresh_cpu_usage();

    let cpu = sys.global_cpu_usage();
    let ram_used = sys.used_memory() / 1024 / 1024;
    let ram_total = sys.total_memory() / 1024 / 1024;
    let ram_pct = if ram_total > 0 {
        ram_used as f32 / ram_total as f32 * 100.0
    } else {
        0.0
    };

    let disks = Disks::new_with_refreshed_list();
    let (disk_used, disk_total) = disks
        .iter()
        .fold((0u64, 0u64), |(used, total), d| {
            (
                used + d.total_space() - d.available_space(),
                total + d.total_space(),
            )
        });

    let disk_used_gb = disk_used as f32 / 1024.0 / 1024.0 / 1024.0;
    let disk_total_gb = disk_total as f32 / 1024.0 / 1024.0 / 1024.0;
    let disk_pct = if disk_total > 0 {
        disk_used as f32 / disk_total as f32 * 100.0
    } else {
        0.0
    };

    Metrics {
        cpu_percent: cpu,
        ram_used_mb: ram_used,
        ram_total_mb: ram_total,
        ram_percent: ram_pct,
        disk_used_gb,
        disk_total_gb,
        disk_percent: disk_pct,
    }
}
