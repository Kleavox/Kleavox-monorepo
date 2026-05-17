// crates/worker/src/routes/auth.rs

use uuid::Uuid;
use wasm_bindgen::JsValue;
use worker::*;

const SESSION_COOKIE: &str = "db_session";
const SESSION_TTL: u64 = 60 * 60 * 24 * 7;

pub async fn github_redirect(_req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let client_id = ctx.env.secret("GITHUB_CLIENT_ID")?.to_string();
    let url = format!(
        "https://github.com/login/oauth/authorize?client_id={client_id}&scope=read:user,user:email"
    );
    Response::redirect(url.parse()?)
}

pub async fn github_callback(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let url = req.url()?;
    let code = url
        .query_pairs()
        .find(|(k, _)| k == "code")
        .map(|(_, v)| v.into_owned())
        .ok_or_else(|| Error::RustError("missing code".into()))?;

    let client_id = ctx.env.secret("GITHUB_CLIENT_ID")?.to_string();
    let client_secret = ctx.env.secret("GITHUB_CLIENT_SECRET")?.to_string();
    let allowed_user = ctx.env.secret("GITHUB_ALLOWED_USER")?.to_string();

    let token = exchange_code(&client_id, &client_secret, &code).await?;
    let login = get_github_login(&token).await?;

    if login.to_lowercase() != allowed_user.to_lowercase() {
        return Response::error("Access denied", 403);
    }

    if let Ok(email) = get_github_email(&token).await {
        let kv = ctx.env.kv("SESSIONS")?;
        let _ = kv.put("owner_email", email.as_str())?.execute().await;
    }

    let session_id = Uuid::new_v4().to_string();
    let kv = ctx.env.kv("SESSIONS")?;
    kv.put(&session_id, login.as_str())?
        .expiration_ttl(SESSION_TTL)
        .execute()
        .await?;

    let cookie = format!(
        "{SESSION_COOKIE}={session_id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age={SESSION_TTL}"
    );
    let headers = Headers::new();
    headers.set("Set-Cookie", &cookie)?;
    headers.set("Location", "/")?;

    Ok(Response::empty()?.with_status(302).with_headers(headers))
}

pub async fn me(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    match get_session_user(&req, &ctx.env).await {
        Some(login) => Response::from_json(&serde_json::json!({ "login": login })),
        None => Response::error("Unauthorized", 401),
    }
}

pub async fn logout(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    if let Some(session_id) = get_session_id(&req) {
        let kv = ctx.env.kv("SESSIONS")?;
        let _ = kv.delete(&session_id).await;
    }

    let cookie = format!("{SESSION_COOKIE}=; Path=/; Max-Age=0");
    let headers = Headers::new();
    headers.set("Set-Cookie", &cookie)?;
    Ok(Response::ok("OK")?.with_headers(headers))
}

pub async fn require_auth(req: &Request, env: &Env) -> Option<Response> {
    if env.var("SKIP_AUTH").map(|v| v.to_string() == "true").unwrap_or(false) {
        return None;
    }
    if get_session_user(req, env).await.is_none() {
        Response::error("Unauthorized", 401).ok()
    } else {
        None
    }
}

async fn get_session_user(req: &Request, env: &Env) -> Option<String> {
    let session_id = get_session_id(req)?;
    let kv = env.kv("SESSIONS").ok()?;
    kv.get(&session_id).text().await.ok().flatten()
}

fn get_session_id(req: &Request) -> Option<String> {
    let cookies = req.headers().get("Cookie").ok()??;
    cookies
        .split(';')
        .find_map(|s| s.trim().strip_prefix(&format!("{SESSION_COOKIE}=")).map(str::to_string))
}

async fn exchange_code(client_id: &str, client_secret: &str, code: &str) -> Result<String> {
    let body = serde_json::json!({
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
    })
    .to_string();

    let headers = Headers::new();
    headers.set("Accept", "application/json")?;
    headers.set("Content-Type", "application/json")?;
    headers.set("User-Agent", "Deauboard/1.0")?;

    let req = Request::new_with_init(
        "https://github.com/login/oauth/access_token",
        RequestInit::new()
            .with_method(Method::Post)
            .with_headers(headers)
            .with_body(Some(JsValue::from_str(&body))),
    )?;

    let mut resp = Fetch::Request(req).send().await?;
    let json: serde_json::Value = resp.json().await?;

    json["access_token"]
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| Error::RustError("GitHub tidak return access_token".into()))
}

async fn get_github_login(token: &str) -> Result<String> {
    let headers = Headers::new();
    headers.set("Authorization", &format!("Bearer {token}"))?;
    headers.set("Accept", "application/vnd.github+json")?;
    headers.set("User-Agent", "Deauboard/1.0")?;

    let req = Request::new_with_init(
        "https://api.github.com/user",
        RequestInit::new()
            .with_method(Method::Get)
            .with_headers(headers),
    )?;

    let mut resp = Fetch::Request(req).send().await?;
    let json: serde_json::Value = resp.json().await?;

    json["login"]
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| Error::RustError("GitHub tidak return login".into()))
}

async fn get_github_email(token: &str) -> Result<String> {
    let headers = Headers::new();
    headers.set("Authorization", &format!("Bearer {token}"))?;
    headers.set("Accept", "application/vnd.github+json")?;
    headers.set("User-Agent", "Deauboard/1.0")?;

    let req = Request::new_with_init(
        "https://api.github.com/user/emails",
        RequestInit::new()
            .with_method(Method::Get)
            .with_headers(headers),
    )?;

    let mut resp = Fetch::Request(req).send().await?;
    let emails: serde_json::Value = resp.json().await?;

    emails
        .as_array()
        .and_then(|arr| {
            arr.iter()
                .find(|e| e["primary"].as_bool().unwrap_or(false))
                .and_then(|e| e["email"].as_str())
                .map(str::to_string)
        })
        .ok_or_else(|| Error::RustError("Tidak ada primary email di GitHub".into()))
}
