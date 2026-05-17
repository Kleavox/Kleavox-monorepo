// crates/worker/src/routes/youtube/mod.rs

use crate::routes::auth::require_auth;
use worker::*;

pub async fn check_live(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    if let Some(err) = require_auth(&req, &ctx.env).await { return Ok(err); }

    let url = req.url()?;
    let handle = url
        .query_pairs()
        .find(|(k, _)| k == "channel")
        .map(|(_, v)| v.into_owned())
        .ok_or_else(|| Error::RustError("missing channel".into()))?;

    let api_key = ctx.env.secret("YOUTUBE_API_KEY")?.to_string();
    let kv = ctx.env.kv("SESSIONS")?;

    let handle_clean = handle.trim_start_matches('@').to_lowercase();
    let cache_key = format!("yt_channel_id:{handle_clean}");

    // Ambil channel ID dari KV (cache), atau resolve dari API
    let channel_id = match kv.get(&cache_key).text().await? {
        Some(id) => id,
        None => {
            let id = resolve_channel_id(&handle_clean, &api_key).await?;
            let _ = kv.put(&cache_key, id.as_str())?.expiration_ttl(86400 * 30).execute().await;
            id
        }
    };

    // Check apakah channel sedang live
    let (is_live, video_id, title) = check_channel_live(&channel_id, &api_key).await?;

    Response::from_json(&serde_json::json!({
        "live": is_live,
        "video_id": video_id,
        "title": title,
    }))
}

async fn resolve_channel_id(handle: &str, api_key: &str) -> Result<String> {
    let url = format!(
        "https://www.googleapis.com/youtube/v3/channels?part=id&forHandle={handle}&key={api_key}"
    );

    let mut init = RequestInit::new();
    init.with_method(Method::Get);

    let req = Request::new_with_init(&url, &init)?;
    let mut resp = Fetch::Request(req).send().await?;
    let json: serde_json::Value = resp.json().await?;

    json["items"][0]["id"]
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| Error::RustError(format!("Channel @{handle} tidak ditemukan")))
}

async fn check_channel_live(
    channel_id: &str,
    api_key: &str,
) -> Result<(bool, Option<String>, Option<String>)> {
    let url = format!(
        "https://www.googleapis.com/youtube/v3/search?part=id,snippet&channelId={channel_id}&eventType=live&type=video&key={api_key}"
    );

    let mut init = RequestInit::new();
    init.with_method(Method::Get);

    let req = Request::new_with_init(&url, &init)?;
    let mut resp = Fetch::Request(req).send().await?;
    let json: serde_json::Value = resp.json().await?;

    let items = json["items"].as_array();
    match items.and_then(|arr| arr.first()) {
        None => Ok((false, None, None)),
        Some(item) => {
            let video_id = item["id"]["videoId"].as_str().map(str::to_string);
            let title = item["snippet"]["title"].as_str().map(str::to_string);
            Ok((true, video_id, title))
        }
    }
}
