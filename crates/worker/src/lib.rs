// crates/worker/src/lib.rs

use worker::*;

mod routes;

#[event(fetch)]
pub async fn main(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    if req.method() == Method::Options {
        let headers = Headers::new();
        headers.set("Access-Control-Allow-Origin", "*")?;
        headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")?;
        headers.set("Access-Control-Allow-Headers", "Content-Type")?;
        return Ok(Response::empty()?.with_headers(headers));
    }

    Router::new()
        .get_async("/api/auth/github", routes::auth::github_redirect)
        .get_async("/api/auth/callback", routes::auth::github_callback)
        .get_async("/api/auth/me", routes::auth::me)
        .post_async("/api/auth/logout", routes::auth::logout)
        .get_async("/api/health", routes::health)
        .get_async("/api/projects", routes::projects::list)
        .post_async("/api/projects", routes::projects::create)
        .patch_async("/api/projects/:id", routes::projects::update)
        .delete_async("/api/projects/:id", routes::projects::delete)
        .get_async("/api/uptime", routes::uptime::list)
        .post_async("/api/uptime", routes::uptime::create)
        .delete_async("/api/uptime/:id", routes::uptime::delete)
        .post_async("/api/uptime/report", routes::uptime::report)
        .get_async("/api/notes", routes::notes::list)
        .post_async("/api/notes", routes::notes::create)
        .patch_async("/api/notes/:id", routes::notes::update)
        .delete_async("/api/notes/:id", routes::notes::delete)
        .get_async("/api/youtube/check", routes::youtube::check_live)
        .get_async("/api/nodes", routes::nodes::list)
        .run(req, env)
        .await
}
