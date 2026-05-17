use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UptimeCheck {
    pub id: u32,
    pub name: String,
    pub url: String,
    pub status: CheckStatus,
    pub last_checked: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CheckStatus {
    Up,
    Down,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: u32,
    pub name: String,
    pub description: String,
    pub status: ProjectStatus,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProjectStatus {
    Todo,
    InProgress,
    Done,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VpsNode {
    pub id: u32,
    pub name: String,
    pub ip: String,
    pub cpu_usage: f32,
    pub memory_usage: f32,
    pub disk_usage: f32,
    pub online: bool,
}
