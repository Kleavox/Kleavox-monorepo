// server/utils/checkLive.ts
import RSSParser from "rss-parser";

const parser = new RSSParser({ customFields: { feed: ["yt:channelId"] } });

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
] as const;

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
}

function browserHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  const ua = randomUA();
  return {
    "User-Agent": ua,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "max-age=0",
    "Sec-Ch-Ua": '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    Referer: "https://www.google.com/",
    // Bypasses some consent pages (vps friendly)
    Cookie: "CONSENT=YES+cb.20210328-17-p0.en+FX+435; GPS=1; VISITOR_INFO1_LIVE=f_M8nK_P6q4",
    ...extra,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export function parseChannelInput(
  input: string,
): { type: string; value: string } | null {
  input = input.trim().replace(/[,/\s]+$/, "");

  const urlHandleMatch = input.match(/youtube\.com\/@([a-zA-Z0-9_.-]+)/i);
  if (urlHandleMatch) return { type: "handle", value: urlHandleMatch[1]! };

  const urlChannelMatch = input.match(
    /youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/i,
  );
  if (urlChannelMatch) return { type: "id", value: urlChannelMatch[1]! };

  if (/^UC[a-zA-Z0-9_-]{22}$/.test(input)) return { type: "id", value: input };

  const bareHandleMatch = input.match(/^@([a-zA-Z0-9_.-]+)$/);
  if (bareHandleMatch) return { type: "handle", value: bareHandleMatch[1]! };

  if (/^[a-zA-Z0-9_.-]{2,}$/.test(input))
    return { type: "handle", value: input };

  return null;
}

async function verifyChannelId(candidateId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${candidateId}`,
      { headers: { "User-Agent": randomUA() } },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function resolveChannelId(
  handle: string,
): Promise<{ channelId: string | null; debug: string[] }> {
  const debug: string[] = [];

  try {
    const res = await fetch(
      `https://www.youtube.com/feeds/videos.xml?forHandle=@${handle}`,
      { headers: { "User-Agent": randomUA() } },
    );
    const xml = await res.text();
    const m = xml.match(/<yt:channelId>(UC[a-zA-Z0-9_-]{22})<\/yt:channelId>/) || 
              xml.match(/<id>yt:channel:(UC[a-zA-Z0-9_-]{22})<\/id>/);
    if (m) return { channelId: m[1]!, debug };
  } catch (e: any) {
    debug.push(`RSS handle error: ${e.message}`);
  }

  try {
    const res = await fetch(`https://www.youtube.com/@${handle}`, {
      headers: browserHeaders(),
    });
    const html = await res.text();
    const m = html.match(/"externalId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/);
    if (m) return { channelId: m[1]!, debug };
  } catch (e: any) {
    debug.push(`Scraping handle error: ${e.message}`);
  }

  return { channelId: null, debug };
}

// ─────────────────────────────────────────────────────────────────────────────

function extractTitle(html: string): string {
  const m = html.match(/<title>([^<]+)<\/title>/);
  return m ? m[1]!.replace(/ - YouTube$/, "").trim() : "Live Stream";
}

async function verifyVideoLive(videoId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: browserHeaders(),
    });
    const status = res.status;
    const html = await res.text();

    if (status === 429) {
      console.warn(`[verify/${videoId}] Rate limited (429)`);
      return false;
    }

    const isLive = html.includes('"isLive":true') || html.includes('yt-live-label-display-renderer');
    const hasHLS = html.includes('"hlsManifestUrl"') || html.includes('.m3u8');
    const isUpcoming = html.includes('"isUpcoming":true') || html.includes('"premiereTimestamp"');

    console.log(`[verify/${videoId}] status=${status} isLive=${isLive} hls=${hasHLS} upcoming=${isUpcoming} len=${html.length}`);

    // Some VPS see a "Before you continue to YouTube" page
    if (html.includes('consent.youtube.com')) {
      console.warn(`[verify/${videoId}] Stuck on consent page!`);
    }

    return (isLive || hasHLS) && !isUpcoming;
  } catch (e: any) {
    console.error(`[verify/${videoId}] error: ${e.message}`);
    return false;
  }
}

export async function checkLive(channelId: string) {
  console.log(`[checkLive/${channelId}] Starting check...`);

  // Method 1: /live redirect
  try {
    const res = await fetch(`https://www.youtube.com/channel/${channelId}/live`, {
      headers: browserHeaders(),
      redirect: "follow",
    });
    const finalUrl = res.url;
    const watchMatch = finalUrl.match(/watch\?v=([a-zA-Z0-9_-]{11})/) || finalUrl.match(/v=([a-zA-Z0-9_-]{11})/);

    console.log(`[checkLive/${channelId}] /live status=${res.status} redirectedUrl=${finalUrl}`);

    if (watchMatch) {
      const videoId = watchMatch[1]!;
      const confirmed = await verifyVideoLive(videoId);
      if (confirmed) {
        const html = await res.text();
        console.log(`[checkLive/${channelId}] Found live via /live redirect: ${videoId}`);
        return { live: true, videoUrl: `https://www.youtube.com/watch?v=${videoId}`, title: extractTitle(html) };
      }
    }
  } catch (e: any) {
    console.error(`[checkLive/${channelId}] /live method failed: ${e.message}`);
  }

  // Method 2: Embed check (often bypasses some bot detection on VPS)
  try {
    const res = await fetch(`https://www.youtube.com/embed/live_stream?channel=${channelId}`, {
      headers: browserHeaders(),
      redirect: "follow",
    });
    const embedUrl = res.url;
    console.log(`[checkLive/${channelId}] embed status=${res.status} url=${embedUrl}`);
    
    // If it's a live stream, it usually redirects to the watch page or stays on embed with videoId
    const videoId = embedUrl.match(/v=([a-zA-Z0-9_-]{11})/) || (await res.text()).match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
    if (videoId) {
      const id = Array.isArray(videoId) ? videoId[1] : videoId;
      console.log(`[checkLive/${channelId}] Found potential video ID via embed: ${id}`);
      if (await verifyVideoLive(id!)) {
        return { live: true, videoUrl: `https://www.youtube.com/watch?v=${id}`, title: "Live Stream" };
      }
    }
  } catch (e: any) {
    console.error(`[checkLive/${channelId}] embed method failed: ${e.message}`);
  }

  // Method 3: RSS Feed
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
      headers: { "User-Agent": randomUA() }
    });
    const xml = await res.text();
    console.log(`[checkLive/${channelId}] RSS status=${res.status} xmlLen=${xml.length}`);
    
    const entries = xml.matchAll(/<link rel="alternate" href="https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})"\/>/g);
    for (const entry of entries) {
      const videoId = entry[1]!;
      if (await verifyVideoLive(videoId)) {
        console.log(`[checkLive/${channelId}] Found live via RSS feed: ${videoId}`);
        return { live: true, videoUrl: `https://www.youtube.com/watch?v=${videoId}`, title: "Live (from feed)" };
      }
    }
  } catch (e: any) {
    console.error(`[checkLive/${channelId}] RSS method failed: ${e.message}`);
  }

  return { live: false };
}
