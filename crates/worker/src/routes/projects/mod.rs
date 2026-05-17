// crates/worker/src/routes/projects/mod.rs

use crate::routes::auth::require_auth;
use deauboard_shared::Project;
use serde::Deserialize;
use uuid::Uuid;
use wasm_bindgen::JsValue;
use worker::*;

#[derive(Deserialize)]
struct CreateProject {
    name: String,
    description: Option<String>,
    url: Option<String>,
    status: Option<String>,
}

#[derive(Deserialize)]
struct UpdateProject {
    status: Option<String>,
    name: Option<String>,
    description: Option<String>,
    url: Option<String>,
}

fn to_js(val: Option<&str>) -> JsValue {
    val.map(JsValue::from_str).unwrap_or(JsValue::NULL)
}

fn get_id(ctx: &RouteContext<()>) -> Option<String> {
    ctx.param("id").map(|s| s.to_string())
}

pub async fn list(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    if let Some(err) = require_auth(&req, &ctx.env).await { return Ok(err); }
    let db = ctx.env.d1("DB")?;
    let projects = db
        .prepare("SELECT id, name, description, status, url, created_at FROM projects ORDER BY created_at DESC")
        .all()
        .await?
        .results::<Project>()?;
    Response::from_json(&projects)
}

pub async fn create(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    if let Some(err) = require_auth(&req, &ctx.env).await { return Ok(err); }
    let body: CreateProject = match req.json().await {
        Ok(b) => b,
        Err(e) => return Response::error(format!("JSON parse error: {e}"), 400),
    };
    if body.name.trim().is_empty() {
        return Response::error("name tidak boleh kosong", 400);
    }

    let id = Uuid::new_v4().to_string();
    let status = body.status.unwrap_or_else(|| "todo".to_string());
    let db = ctx.env.d1("DB")?;

    let bind = db
        .prepare("INSERT INTO projects (id, name, description, status, url) VALUES (?1, ?2, ?3, ?4, ?5)")
        .bind(&[
            JsValue::from_str(&id),
            JsValue::from_str(&body.name),
            to_js(body.description.as_deref()),
            JsValue::from_str(&status),
            to_js(body.url.as_deref()),
        ]);

    match bind {
        Err(e) => return Response::error(format!("D1 bind error: {e}"), 500),
        Ok(s) => if let Err(e) = s.run().await {
            return Response::error(format!("D1 insert error: {e}"), 500);
        }
    }

    let project = db
        .prepare("SELECT id, name, description, status, url, created_at FROM projects WHERE id = ?1")
        .bind(&[JsValue::from_str(&id)])?
        .first::<Project>(None)
        .await?;

    match project {
        Some(p) => Response::from_json(&p),
        None => Response::error("Insert berhasil tapi row tidak ditemukan", 500),
    }
}

pub async fn update(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    if let Some(err) = require_auth(&req, &ctx.env).await { return Ok(err); }
    let id = match get_id(&ctx) {
        Some(id) => id,
        None => return Response::error("ID tidak valid", 400),
    };
    let body: UpdateProject = match req.json().await {
        Ok(b) => b,
        Err(e) => return Response::error(format!("JSON parse error: {e}"), 400),
    };
    let db = ctx.env.d1("DB")?;

    let exists = db
        .prepare("SELECT id FROM projects WHERE id = ?1")
        .bind(&[JsValue::from_str(&id)])?
        .first::<serde_json::Value>(None)
        .await?;
    if exists.is_none() {
        return Response::error("Project tidak ditemukan", 404);
    }

    if let Some(s) = &body.status {
        db.prepare("UPDATE projects SET status = ?1 WHERE id = ?2")
            .bind(&[JsValue::from_str(s), JsValue::from_str(&id)])?
            .run().await?;
    }
    if let Some(n) = &body.name {
        db.prepare("UPDATE projects SET name = ?1 WHERE id = ?2")
            .bind(&[JsValue::from_str(n), JsValue::from_str(&id)])?
            .run().await?;
    }
    if let Some(d) = &body.description {
        db.prepare("UPDATE projects SET description = ?1 WHERE id = ?2")
            .bind(&[JsValue::from_str(d), JsValue::from_str(&id)])?
            .run().await?;
    }
    if let Some(u) = &body.url {
        db.prepare("UPDATE projects SET url = ?1 WHERE id = ?2")
            .bind(&[JsValue::from_str(u), JsValue::from_str(&id)])?
            .run().await?;
    }

    let project = db
        .prepare("SELECT id, name, description, status, url, created_at FROM projects WHERE id = ?1")
        .bind(&[JsValue::from_str(&id)])?
        .first::<Project>(None)
        .await?;

    match project {
        Some(p) => Response::from_json(&p),
        None => Response::error("Project tidak ditemukan", 404),
    }
}

pub async fn delete(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    if let Some(err) = require_auth(&req, &ctx.env).await { return Ok(err); }
    let id = match get_id(&ctx) {
        Some(id) => id,
        None => return Response::error("ID tidak valid", 400),
    };
    let db = ctx.env.d1("DB")?;
    let result = db
        .prepare("DELETE FROM projects WHERE id = ?1")
        .bind(&[JsValue::from_str(&id)])?
        .run().await?;

    if result.meta().ok().flatten().and_then(|m| m.changes).unwrap_or(0) == 0 {
        return Response::error("Project tidak ditemukan", 404);
    }
    Response::ok("OK")
}
