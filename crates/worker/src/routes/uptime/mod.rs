// crates/worker/src/routes/uptime/mod.rs

use crate::routes::auth::require_auth;
use deauboard_shared::UptimeCheck;
use serde::Deserialize;
use uuid::Uuid;
use wasm_bindgen::JsValue;
use worker::*;

#[derive(Deserialize)]
struct CreateCheck {
    name: String,
    url: String,
    node_name: String,
}

#[derive(Deserialize)]
struct Report {
    check_id: String,
    status: String,
    response_ms: Option<u32>,
}

pub async fn list(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    if let Some(err) = require_auth(&req, &ctx.env).await { return Ok(err); }
    let db = ctx.env.d1("DB")?;
    let checks = db
        .prepare("SELECT id, name, url, node_name, status, response_ms, last_checked, created_at FROM uptime_checks ORDER BY node_name, name")
        .all()
        .await?
        .results::<UptimeCheck>()?;
    Response::from_json(&checks)
}

pub async fn create(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let agent_key = ctx.env.secret("AGENT_API_KEY").ok().map(|s| s.to_string());
    let auth_header = req.headers().get("Authorization").ok().flatten().unwrap_or_default();
    let is_agent = agent_key.map(|k| auth_header == format!("Bearer {k}")).unwrap_or(false);
    if !is_agent {
        if let Some(err) = require_auth(&req, &ctx.env).await { return Ok(err); }
    }
    let body: CreateCheck = match req.json().await {
        Ok(b) => b,
        Err(e) => return Response::error(format!("JSON error: {e}"), 400),
    };

    let id = Uuid::new_v4().to_string();
    let db = ctx.env.d1("DB")?;
    db.prepare("INSERT INTO uptime_checks (id, name, url, node_name) VALUES (?1, ?2, ?3, ?4)")
        .bind(&[
            JsValue::from_str(&id),
            JsValue::from_str(&body.name),
            JsValue::from_str(&body.url),
            JsValue::from_str(&body.node_name),
        ])?
        .run()
        .await?;

    let check = db
        .prepare("SELECT id, name, url, node_name, status, response_ms, last_checked, created_at FROM uptime_checks WHERE id = ?1")
        .bind(&[JsValue::from_str(&id)])?
        .first::<UptimeCheck>(None)
        .await?;

    match check {
        Some(c) => Response::from_json(&c),
        None => Response::error("Gagal membuat check", 500),
    }
}

pub async fn delete(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    if let Some(err) = require_auth(&req, &ctx.env).await { return Ok(err); }
    let id = match ctx.param("id") {
        Some(id) => id.to_string(),
        None => return Response::error("ID tidak valid", 400),
    };
    let db = ctx.env.d1("DB")?;
    db.prepare("DELETE FROM uptime_checks WHERE id = ?1")
        .bind(&[JsValue::from_str(&id)])?
        .run()
        .await?;
    Response::ok("OK")
}

pub async fn report(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let expected_key = ctx.env.secret("AGENT_API_KEY")?.to_string();
    let auth = req.headers().get("Authorization")?.unwrap_or_default();
    if auth != format!("Bearer {expected_key}") {
        return Response::error("Unauthorized", 401);
    }

    let body: Report = match req.json().await {
        Ok(b) => b,
        Err(e) => return Response::error(format!("JSON error: {e}"), 400),
    };

    let db = ctx.env.d1("DB")?;

    let prev = db
        .prepare("SELECT status, alerted FROM uptime_checks WHERE id = ?1")
        .bind(&[JsValue::from_str(&body.check_id)])?
        .first::<serde_json::Value>(None)
        .await?;

    let prev_status = prev.as_ref()
        .and_then(|v| v["status"].as_str())
        .unwrap_or("unknown")
        .to_string();
    let was_alerted = prev.as_ref()
        .and_then(|v| v["alerted"].as_i64())
        .unwrap_or(0);

    let response_ms = body.response_ms.map(|ms| JsValue::from_f64(ms as f64))
        .unwrap_or(JsValue::NULL);
    let alerted = if body.status == "down" && was_alerted == 0 { 1 } else if body.status == "up" { 0 } else { was_alerted };

    db.prepare(
        "UPDATE uptime_checks SET status = ?1, response_ms = ?2, last_checked = datetime('now'), alerted = ?3 WHERE id = ?4"
    )
    .bind(&[
        JsValue::from_str(&body.status),
        response_ms,
        JsValue::from_f64(alerted as f64),
        JsValue::from_str(&body.check_id),
    ])?
    .run()
    .await?;

    if body.status == "down" && prev_status != "down" {
        let _ = send_down_alert(&ctx.env, &body.check_id).await;
    }

    Response::ok("OK")
}

async fn send_down_alert(env: &Env, check_id: &str) -> Result<()> {
    let api_key = env.secret("RESEND_API_KEY")?.to_string();
    let kv = env.kv("SESSIONS")?;
    let to_email = match kv.get("owner_email").text().await? {
        Some(e) => e,
        None => return Ok(()),
    };

    let db = env.d1("DB")?;
    let check = db
        .prepare("SELECT name, url, node_name FROM uptime_checks WHERE id = ?1")
        .bind(&[JsValue::from_str(check_id)])?
        .first::<serde_json::Value>(None)
        .await?;

    let name = check.as_ref().and_then(|v| v["name"].as_str()).unwrap_or("Unknown");
    let url = check.as_ref().and_then(|v| v["url"].as_str()).unwrap_or("");
    let node = check.as_ref().and_then(|v| v["node_name"].as_str()).unwrap_or("");

    let body = serde_json::json!({
        "from": "Deauboard <alert@deau.site>",
        "to": [to_email],
        "subject": format!("⚠️ {} is DOWN", name),
        "html": format!(
            "<p><strong>{name}</strong> di node <code>{node}</code> tidak dapat dijangkau.</p><p>URL: <code>{url}</code></p><p>Cek dashboard: <a href='https://board.deau.site'>board.deau.site</a></p>"
        )
    }).to_string();

    let headers = Headers::new();
    headers.set("Authorization", &format!("Bearer {api_key}"))?;
    headers.set("Content-Type", "application/json")?;

    let req = Request::new_with_init(
        "https://api.resend.com/emails",
        RequestInit::new()
            .with_method(Method::Post)
            .with_headers(headers)
            .with_body(Some(wasm_bindgen::JsValue::from_str(&body))),
    )?;

    let _ = Fetch::Request(req).send().await;
    Ok(())
}
