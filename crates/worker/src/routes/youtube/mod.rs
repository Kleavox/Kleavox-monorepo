// crates/worker/src/routes/youtube/mod.rs

use crate::routes::auth::require_auth;
use worker::*;

pub async fn check_live(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    if let Some(err) = require_auth(&req, &ctx.env).await { return Ok(err); }

    let url = req.url()?;
    let channel = url
        .query_pairs()
        .find(|(k, _)| k == "channel")
        .map(|(_, v)| v.into_owned())
        .ok_or_else(|| Error::RustError("missing channel param".into()))?;

    let channel_url = if channel.starts_with('@') {
        format!("https://www.youtube.com/{channel}/live")
    } else {
        format!("https://www.youtube.com/@{channel}/live")
    };

    let headers = Headers::new();
    headers.set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36")?;
    headers.set("Accept-Language", "en-US,en;q=0.9")?;

    let fetch_req = Request::new_with_init(
        &channel_url,
        RequestInit::new()
            .with_method(Method::Get)
            .with_headers(headers),
    )?;

    let mut resp = Fetch::Request(fetch_req).send().await?;
    let html = resp.text().await?;

    // Cara paling reliable: kalau channel /live itu aktif,
    // canonical URL-nya berubah jadi /watch?v=VIDEO_ID
    let is_live = html.contains("\"isLiveNow\":true")
        && (html.contains("\"canonical\":\"https://www.youtube.com/watch?v=")
            || html.contains(r#"<link rel="canonical" href="https://www.youtube.com/watch?v="#));

    let video_id = if is_live { extract_video_id(&html) } else { None };
    let title = extract_title(&html);

    Response::from_json(&serde_json::json!({
        "live": is_live,
        "video_id": video_id,
        "title": title,
    }))
}

fn extract_video_id(html: &str) -> Option<String> {
    let marker = "\"canonical\":\"https://www.youtube.com/watch?v=";
    if let Some(start) = html.find(marker) {
        let rest = &html[start + marker.len()..];
        let end = rest.find('"')?;
        return Some(rest[..end].to_string());
    }
    let marker2 = r#"<link rel="canonical" href="https://www.youtube.com/watch?v="#;
    if let Some(start) = html.find(marker2) {
        let rest = &html[start + marker2.len()..];
        let end = rest.find('"')?;
        return Some(rest[..end].to_string());
    }
    None
}

fn extract_title(html: &str) -> Option<String> {
    let start = html.find("<title>")? + 7;
    let end = html[start..].find("</title>")? + start;
    let raw = html[start..end].replace(" - YouTube", "");
    let clean = raw.trim().to_string();
    if clean.is_empty() { None } else { Some(clean) }
}
