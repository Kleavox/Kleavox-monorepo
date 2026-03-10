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

function browserHeaders(): Record<string, string> {
  return {
    "User-Agent": randomUA(),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Referer": "https://www.google.com/",
    "Cookie": "CONSENT=YES+cb.20210328-17-p0.en+FX+435; VISITOR_INFO1_LIVE=f_M8nK_P6q4",
  };
}

function isActuallyLive(html: string, channelId: string, context: string): boolean {
  // 1. Ownership Check: Video MUST belong to the target channel
  const isOwner = html.includes(`"channelId":"${channelId}"`) || 
                  html.includes(`"externalId":"${channelId}"`) || 
                  html.includes(`"browseId":"${channelId}"`) ||
                  html.includes(`"/channel/${channelId}"`) ||
                  html.includes(`"canonicalBaseUrl":"/@`); // Handles are trickier, but UC id is usually in JSON

  if (!isOwner) {
    // If we can't find the channel ID in the HTML data, it's likely a recommended video
    return false;
  }

  // 2. Status Check: Must be currently LIVE
  const indicators = {
    isLiveTrue: html.includes('"isLive":true'),
    styleLive: html.includes('"style":"LIVE"'),
    labelLive: html.includes('"label":"LIVE"'),
    indicatorTag: html.includes('yt-live-label-display-renderer'),
    hls: html.includes('hlsManifestUrl')
  };
  
  const isUpcoming = html.includes('"isUpcoming":true') || 
                     html.includes('"style":"UPCOMING"') || 
                     html.includes('"upcomingEventData"');
  
  const hasLiveIndicator = Object.values(indicators).some(v => v);
  const live = hasLiveIndicator && !isUpcoming;
  
  if (live) {
    const found = Object.entries(indicators).filter(([_, v]) => v).map(([k]) => k).join(', ');
    console.log(`[checkLive/verify] ${context} - LIVE CONFIRMED for ${channelId} via: ${found}`);
  }
  
  return live;
}

function extractPrimaryVideoId(html: string): string | null {
  // Priority 1: Canonical link (present on watch pages)
  const canonical = html.match(/<link\s+rel="canonical"\s+href="https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})"/);
  if (canonical) return canonical[1]!;

  // Priority 2: Main player microformat
  const micro = html.match(/"playerMicroformatRenderer"\s*:\s*\{.*?"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
  if (micro) return micro[1]!;
  
  // Priority 3: Video details in initial player response
  const details = html.match(/"videoDetails"\s*:\s*\{.*?"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
  if (details) return details[1]!;

  return null;
}

function extractTitle(html: string): string {
  const m = html.match(/<title>([^<]+)<\/title>/);
  return m ? m[1]!.replace(/ - YouTube$/, "").trim() : "Live Stream";
}

export async function checkLive(channelId: string) {
  console.log(`[checkLive/${channelId}] Starting check...`);

  // Method 1: /live endpoint
  try {
    const res = await fetch(`https://www.youtube.com/channel/${channelId}/live`, {
      headers: browserHeaders(),
      redirect: "follow",
    });
    const finalUrl = res.url;
    const html = await res.text();

    console.log(`[checkLive/${channelId}] Method 1 status=${res.status} finalUrl=${finalUrl}`);

    const videoId = finalUrl.match(/v=([a-zA-Z0-9_-]{11})/)?.[1] || extractPrimaryVideoId(html);
    
    if (videoId && isActuallyLive(html, channelId, `Method 1 (${videoId})`)) {
      return { live: true, videoUrl: `https://www.youtube.com/watch?v=${videoId}`, title: extractTitle(html) };
    }
  } catch (e: any) {
    console.error(`[checkLive/${channelId}] Method 1 error: ${e.message}`);
  }

  // Method 2: Embed (Often bypasses VPS blocking)
  try {
    const res = await fetch(`https://www.youtube.com/embed/live_stream?channel=${channelId}`, {
      headers: browserHeaders(),
    });
    const html = await res.text();
    const videoId = extractPrimaryVideoId(html);

    if (videoId) {
      console.log(`[checkLive/${channelId}] Method 2 found videoId: ${videoId}`);
      if (isActuallyLive(html, channelId, `Method 2 (${videoId})`)) {
        return { live: true, videoUrl: `https://www.youtube.com/watch?v=${videoId}`, title: "Live Stream" };
      }
    }
  } catch (e: any) {
    console.error(`[checkLive/${channelId}] Method 2 error: ${e.message}`);
  }

  // Method 3: RSS (Fallback)
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
      headers: { "User-Agent": randomUA() }
    });
    const xml = await res.text();
    const firstMatch = xml.match(/<link rel="alternate" href="https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})"\/>/);
    
    if (firstMatch) {
      const videoId = firstMatch[1]!;
      console.log(`[checkLive/${channelId}] Method 3 (RSS) checking video: ${videoId}`);
      const vRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, { headers: browserHeaders() });
      const vHtml = await vRes.text();
      if (isActuallyLive(vHtml, channelId, `Method 3 (${videoId})`)) {
        return { live: true, videoUrl: `https://www.youtube.com/watch?v=${videoId}`, title: extractTitle(vHtml) };
      }
    }
  } catch {}

  console.log(`[checkLive/${channelId}] Result: Still waiting...`);
  return { live: false };
}

export function parseChannelInput(input: string) {
  input = input.trim();
  const h = input.match(/youtube\.com\/@([a-zA-Z0-9_.-]+)/i) || input.match(/^@([a-zA-Z0-9_.-]+)$/);
  if (h) return { type: "handle", value: h[1]! };
  const id = input.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/i) || input.match(/^(UC[a-zA-Z0-9_-]{22})$/);
  if (id) return { type: "id", value: id[1]! };
  if (/^[a-zA-Z0-9_.-]{2,}$/.test(input)) return { type: "handle", value: input };
  return null;
}

export async function resolveChannelId(handle: string) {
  try {
    const res = await fetch(`https://www.youtube.com/@${handle}`, { headers: browserHeaders() });
    const html = await res.text();
    const m = html.match(/"externalId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/);
    return { channelId: m ? m[1]! : null, debug: [] };
  } catch {
    return { channelId: null, debug: [] };
  }
}
