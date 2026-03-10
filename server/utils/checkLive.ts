// server/utils/checkLive.ts
import RSSParser from "rss-parser";

const parser = new RSSParser({ customFields: { feed: ["yt:channelId"] } });

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
] as const;

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
}

function browserHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    "User-Agent": randomUA(),
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Upgrade-Insecure-Requests": "1",
    Referer: "https://www.youtube.com/",
    // Bypasses some consent pages
    Cookie: "CONSENT=PENDING+999; YES+",
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
    if (!res.ok) {
      console.log(`[verify/${videoId}] fetch failed: ${res.status}`);
      return false;
    }
    const html = await res.text();

    const isLive = html.includes('"isLive":true');
    const hasHLS = html.includes('"hlsManifestUrl"');
    const isUpcoming = html.includes('"isUpcoming":true') || html.includes('"premiereTimestamp"');

    console.log(`[verify/${videoId}] status=${res.status} isLive=${isLive} hls=${hasHLS} upcoming=${isUpcoming}`);

    return (isLive || hasHLS) && !isUpcoming;
  } catch (e: any) {
    console.log(`[verify/${videoId}] error: ${e.message}`);
    return false;
  }
}

export async function checkLive(channelId: string) {
  // Method 1: /live redirect
  try {
    const res = await fetch(`https://www.youtube.com/channel/${channelId}/live`, {
      headers: browserHeaders(),
      redirect: "follow",
    });
    const finalUrl = res.url;
    const watchMatch = finalUrl.match(/watch\?v=([a-zA-Z0-9_-]{11})/);

    console.log(`[checkLive/${channelId}] /live status=${res.status} url=${finalUrl}`);

    if (watchMatch) {
      const videoId = watchMatch[1]!;
      const confirmed = await verifyVideoLive(videoId);
      if (confirmed) {
        const html = await res.text();
        return { live: true, videoUrl: finalUrl, title: extractTitle(html) };
      }
    }
  } catch (e: any) {
    console.log(`[checkLive/${channelId}] /live error: ${e.message}`);
  }

  // Method 2: Embed check (often bypasses some bot detection)
  try {
    const res = await fetch(`https://www.youtube.com/embed/live_stream?channel=${channelId}`, {
      headers: browserHeaders(),
      redirect: "follow",
    });
    console.log(`[checkLive/${channelId}] embed status=${res.status} url=${res.url}`);
    if (res.url.includes("watch?v=")) {
      const videoId = res.url.match(/v=([a-zA-Z0-9_-]{11})/)?.[1];
      if (videoId && await verifyVideoLive(videoId)) {
        return { live: true, videoUrl: res.url, title: "Live Stream" };
      }
    }
  } catch (e: any) {
    console.log(`[checkLive/${channelId}] embed error: ${e.message}`);
  }

  // Method 3: RSS Fallback
  try {
    const feed = await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
    for (const item of feed.items.slice(0, 3)) {
      const videoId = item.link?.match(/v=([a-zA-Z0-9_-]+)/)?.[1];
      if (videoId && await verifyVideoLive(videoId)) {
        return { live: true, videoUrl: item.link!, title: item.title ?? "Live" };
      }
    }
  } catch (e: any) {
    console.log(`[checkLive/${channelId}] RSS error: ${e.message}`);
  }

  return { live: false };
}
