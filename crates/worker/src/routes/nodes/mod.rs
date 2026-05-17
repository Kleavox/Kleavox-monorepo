use worker::*;

pub async fn list(_req: Request, _ctx: RouteContext<()>) -> Result<Response> {
    // TODO: fetch from Kronyx agents
    Response::from_json(&serde_json::json!([]))
}
