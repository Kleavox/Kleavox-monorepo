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
        .ok_or_else(|| Error::RustError("missing channel".into()))?;

    let channel_url = if channel.starts_with('@') {
        format!("https://www.youtube.com/{channel}/live")
    } else {
        format!("https://www.youtube.com/@{channel}/live")
    };

    let headers = Headers::new();
    headers.set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")?;
    headers.set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")?;
    headers.set("Accept-Language", "en-US,en;q=0.9")?;

    // Manual redirect: kalau YouTube live, /live akan redirect ke /watch?v=VIDEO_ID
    let mut init = RequestInit::new();
    init.with_method(Method::Get)
        .with_headers(headers)
        .with_redirect(RequestRedirect::Manual);

    let fetch_req = Request::new_with_init(&channel_url, &init)?;
    let resp = Fetch::Request(fetch_req).send().await?;
    let status = resp.status_code();

    // 301/302 redirect ke /watch?v=... = live
    if status == 301 || status == 302 {
        let location = resp.headers().get("Location")?.unwrap_or_default();
        if location.contains("watch?v=") {
            let video_id = location
                .split("watch?v=").nth(1)
                .map(|s| s.split('&').next().unwrap_or(s).to_string())
                .filter(|s| !s.is_empty());

            let title = match video_id.as_ref() {
                Some(vid) => fetch_video_title(vid).await,
                None => None,
            };

            return Response::from_json(&serde_json::json!({
                "live": true,
                "video_id": video_id,
                "title": title,
            }));
        }
    }

    Response::from_json(&serde_json::json!({
        "live": false,
        "video_id": null,
        "title": null,
    }))
}

async fn fetch_video_title(video_id: &str) -> Option<String> {
    let url = format!("https://www.youtube.com/oembed?url=https://youtube.com/watch?v={video_id}&format=json");
    let headers = Headers::new();
    let _ = headers.set("User-Agent", "Deauboard/1.0");

    let mut init = RequestInit::new();
    init.with_method(Method::Get).with_headers(headers);

    let req = Request::new_with_init(&url, &init).ok()?;
    let mut resp = Fetch::Request(req).send().await.ok()?;
    let json: serde_json::Value = resp.json().await.ok()?;
    json["title"].as_str().map(str::to_string)
}
