use worker::*;

pub async fn list(_req: Request, _ctx: RouteContext<()>) -> Result<Response> {
    // TODO: query D1 for projects
    Response::from_json(&serde_json::json!([]))
}
