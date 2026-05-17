use worker::*;

mod routes;

#[event(fetch)]
pub async fn main(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    Router::new()
        .get("/", |_, _| Response::ok("Deauboard"))
        .get_async("/api/health", routes::health)
        .get_async("/api/uptime", routes::uptime::list)
        .get_async("/api/projects", routes::projects::list)
        .get_async("/api/nodes", routes::nodes::list)
        .run(req, env)
        .await
}
