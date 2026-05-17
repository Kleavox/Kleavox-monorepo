use worker::*;

pub async fn list(_req: Request, _ctx: RouteContext<()>) -> Result<Response> {
    // TODO: query D1 for uptime checks
    Response::from_json(&serde_json::json!([]))
}
