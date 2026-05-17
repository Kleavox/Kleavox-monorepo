use worker::*;

pub mod auth;
pub mod nodes;
pub mod projects;
pub mod uptime;

pub async fn health(_req: Request, _ctx: RouteContext<()>) -> Result<Response> {
    Response::ok("OK")
}
