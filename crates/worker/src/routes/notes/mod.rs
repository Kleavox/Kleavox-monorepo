// crates/worker/src/routes/notes/mod.rs

use crate::routes::auth::require_auth;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use wasm_bindgen::JsValue;
use worker::*;

#[derive(Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub content: String,
    pub pinned: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
struct CreateNote {
    content: String,
    pinned: Option<i64>,
}

#[derive(Deserialize)]
struct UpdateNote {
    content: Option<String>,
    pinned: Option<i64>,
}

pub async fn list(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    if let Some(err) = require_auth(&req, &ctx.env).await { return Ok(err); }
    let db = ctx.env.d1("DB")?;
    let notes = db
        .prepare("SELECT id, content, pinned, created_at, updated_at FROM notes ORDER BY pinned DESC, updated_at DESC")
        .all()
        .await?
        .results::<Note>()?;
    Response::from_json(&notes)
}

pub async fn create(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    if let Some(err) = require_auth(&req, &ctx.env).await { return Ok(err); }
    let body: CreateNote = match req.json().await {
        Ok(b) => b,
        Err(e) => return Response::error(format!("JSON error: {e}"), 400),
    };
    if body.content.trim().is_empty() {
        return Response::error("content tidak boleh kosong", 400);
    }

    let id = Uuid::new_v4().to_string();
    let pinned = body.pinned.unwrap_or(0);
    let db = ctx.env.d1("DB")?;

    db.prepare("INSERT INTO notes (id, content, pinned) VALUES (?1, ?2, ?3)")
        .bind(&[
            JsValue::from_str(&id),
            JsValue::from_str(&body.content),
            JsValue::from_f64(pinned as f64),
        ])?
        .run()
        .await?;

    let note = db
        .prepare("SELECT id, content, pinned, created_at, updated_at FROM notes WHERE id = ?1")
        .bind(&[JsValue::from_str(&id)])?
        .first::<Note>(None)
        .await?;

    match note {
        Some(n) => Response::from_json(&n),
        None => Response::error("Gagal membuat note", 500),
    }
}

pub async fn update(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    if let Some(err) = require_auth(&req, &ctx.env).await { return Ok(err); }
    let id = match ctx.param("id") {
        Some(id) => id.to_string(),
        None => return Response::error("ID tidak valid", 400),
    };
    let body: UpdateNote = match req.json().await {
        Ok(b) => b,
        Err(e) => return Response::error(format!("JSON error: {e}"), 400),
    };

    let db = ctx.env.d1("DB")?;

    if let Some(content) = &body.content {
        db.prepare("UPDATE notes SET content = ?1, updated_at = datetime('now') WHERE id = ?2")
            .bind(&[JsValue::from_str(content), JsValue::from_str(&id)])?
            .run().await?;
    }
    if let Some(pinned) = body.pinned {
        db.prepare("UPDATE notes SET pinned = ?1, updated_at = datetime('now') WHERE id = ?2")
            .bind(&[JsValue::from_f64(pinned as f64), JsValue::from_str(&id)])?
            .run().await?;
    }

    let note = db
        .prepare("SELECT id, content, pinned, created_at, updated_at FROM notes WHERE id = ?1")
        .bind(&[JsValue::from_str(&id)])?
        .first::<Note>(None)
        .await?;

    match note {
        Some(n) => Response::from_json(&n),
        None => Response::error("Note tidak ditemukan", 404),
    }
}

pub async fn delete(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    if let Some(err) = require_auth(&req, &ctx.env).await { return Ok(err); }
    let id = match ctx.param("id") {
        Some(id) => id.to_string(),
        None => return Response::error("ID tidak valid", 400),
    };
    let db = ctx.env.d1("DB")?;
    db.prepare("DELETE FROM notes WHERE id = ?1")
        .bind(&[JsValue::from_str(&id)])?
        .run().await?;
    Response::ok("OK")
}
