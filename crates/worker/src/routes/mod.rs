use worker::*;

pub mod uptime;
pub mod projects;
pub mod nodes;

pub async fn health(_req: Request, _ctx: RouteContext<()>) -> Result<Response> {
    Response::ok("OK")
}
