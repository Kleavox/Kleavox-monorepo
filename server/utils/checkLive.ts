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
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Referer": "https://www.google.com/",
    "Cookie": "CONSENT=YES+cb.20210328-17-p0.en+FX+435",
  };
}

function extractVideoId(html: string): string | null {
  const match = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/) || 
                html.match(/watch\?v=([a-zA-Z0-9_-]{11})/) ||
                html.match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
  return match ? match[1]! : null;
}

function isLiveInHtml(html: string): boolean {
  return (html.includes('"isLive":true') || 
          html.includes('yt-live-label-display-renderer') || 
          html.includes('LIVE')) && 
         !html.includes('"isUpcoming":true');
}

async function verifyWithOEmbed(videoId: string): Promise<boolean> {
  // oEmbed is a official, lightweight endpoint often less rate-limited
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {
      headers: { "User-Agent": randomUA() }
    });
    // This just confirms the video exists/is public. 
    // We combine this with RSS/Scraping signals.
    return res.ok;
  } catch {
    return false;
  }
}

export async function checkLive(channelId: string) {
  console.log(`[checkLive/${channelId}] Checking...`);

  // Method 1: /live endpoint - Deep Scrape (1 request)
  try {
    const res = await fetch(`https://www.youtube.com/channel/${channelId}/live`, {
      headers: browserHeaders(),
      redirect: "follow",
    });
    const html = await res.text();
    const videoId = extractVideoId(html);
    
    console.log(`[checkLive/${channelId}] /live status=${res.status} videoId=${videoId}`);

    if (videoId && isLiveInHtml(html)) {
      console.log(`[checkLive/${channelId}] ✓ CONFIRMED LIVE via /live scrape`);
      return { live: true, videoUrl: `https://www.youtube.com/watch?v=${videoId}`, title: "Live Stream" };
    }
  } catch (e: any) {
    console.error(`[checkLive/${channelId}] /live failed: ${e.message}`);
  }

  // Method 2: Embed (1 request)
  try {
    const res = await fetch(`https://www.youtube.com/embed/live_stream?channel=${channelId}`, {
      headers: browserHeaders(),
    });
    const html = await res.text();
    const videoId = extractVideoId(html);
    
    if (videoId && isLiveInHtml(html)) {
      console.log(`[checkLive/${channelId}] ✓ CONFIRMED LIVE via embed scrape`);
      return { live: true, videoUrl: `https://www.youtube.com/watch?v=${videoId}`, title: "Live Stream" };
    }
  } catch (e: any) {
    console.error(`[checkLive/${channelId}] embed failed: ${e.message}`);
  }

  // Method 3: RSS - Only verify the LATEST item (1 request)
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
      headers: { "User-Agent": randomUA() }
    });
    const xml = await res.text();
    const firstMatch = xml.match(/<link rel="alternate" href="https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})"\/>/);
    
    if (firstMatch) {
      const videoId = firstMatch[1]!;
      // If RSS lists it, we only do ONE oEmbed check to see if it's still up
      if (await verifyWithOEmbed(videoId)) {
        // Unfortunately RSS doesn't tell us if it's LIVE, so we still need a light check
        // But let's assume if Method 1 & 2 failed, we stay waiting unless we are 100% sure
      }
    }
  } catch (e: any) {
    console.error(`[checkLive/${channelId}] RSS failed: ${e.message}`);
  }

  return { live: false };
}

// Support functions for handling input
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
