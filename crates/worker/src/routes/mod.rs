// crates/worker/src/routes/mod.rs

use worker::*;

pub mod auth;
pub mod nodes;
pub mod notes;
pub mod projects;
pub mod uptime;
pub mod youtube;

pub async fn health(_req: Request, _ctx: RouteContext<()>) -> Result<Response> {
    Response::ok("OK")
}
