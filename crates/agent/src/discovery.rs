// crates/agent/src/discovery.rs

use crate::checker::check_tcp;

pub struct DiscoveredService {
    pub name: String,
    pub url: String,
}

const COMMON_PORTS: &[(u16, &str, &str)] = &[
    (80,   "Nginx/HTTP",       "http://localhost:80"),
    (443,  "HTTPS",            "https://localhost:443"),
    (3000, "App (port 3000)",  "http://localhost:3000"),
    (8080, "App (port 8080)",  "http://localhost:8080"),
    (8443, "App (port 8443)",  "https://localhost:8443"),
    (8096, "Jellyfin",         "http://localhost:8096"),
    (8123, "Home Assistant",   "http://localhost:8123"),
    (9000, "Portainer",        "http://localhost:9000"),
    (9090, "Prometheus",       "http://localhost:9090"),
    (3001, "App (port 3001)",  "http://localhost:3001"),
    (5000, "App (port 5000)",  "http://localhost:5000"),
    (6379, "Redis",            "tcp://localhost:6379"),
    (5432, "PostgreSQL",       "tcp://localhost:5432"),
    (3306, "MySQL",            "tcp://localhost:3306"),
];

pub async fn discover() -> Vec<DiscoveredService> {
    let mut found = vec![];
    for (port, name, url) in COMMON_PORTS {
        if check_tcp("localhost", *port).await.unwrap_or(false) {
            found.push(DiscoveredService {
                name: name.to_string(),
                url: url.to_string(),
            });
        }
    }
    found
}
