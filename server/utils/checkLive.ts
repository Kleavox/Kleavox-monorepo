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

export function isActuallyLive(html: string, channelId: string, context: string): boolean {
  const isOwner = html.includes(`"channelId":"${channelId}"`) || 
                  html.includes(`"externalId":"${channelId}"`) || 
                  html.includes(`"browseId":"${channelId}"`) ||
                  html.includes(`"/channel/${channelId}"`);

  if (!isOwner) return false;

  const isEnded = html.includes('Streamed live') || 
                  html.includes('Siaran langsung berakhir') || 
                  html.includes('Livestream ended') ||
                  html.includes('"status":"ENDED"') ||
                  html.includes('"isPostLiveDvr":true') ||
                  html.includes('"endDate"');

  if (isEnded) return false;

  const isLiveNow = html.includes('"isLiveNow":true') || 
                    html.includes('"isLive":true') ||
                    (html.includes('"style":"LIVE"') && html.includes('"label":"LIVE"')) ||
                    html.includes('yt-live-label-display-renderer');

  const isUpcoming = html.includes('"isUpcoming":true') || html.includes('"style":"UPCOMING"');

  const live = isLiveNow && !isUpcoming;
  
  if (live) {
    console.log(`[checkLive/verify] ${context} - LIVE CONFIRMED for ${channelId}`);
  }
  
  return live;
}

function extractPrimaryVideoId(html: string): string | null {
  const canonical = html.match(/<link\s+rel="canonical"\s+href="https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})"/);
  if (canonical) return canonical[1]!;

  const micro = html.match(/"playerMicroformatRenderer"\s*:\s*\{.*?"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
  if (micro) return micro[1]!;
  
  return null;
}

export function extractTitle(html: string): string {
  const m = html.match(/<title>([^<]+)<\/title>/);
  return m ? m[1]!.replace(/ - YouTube$/, "").trim() : "Live Stream";
}

export async function checkLive(channelId: string) {
  console.log(`[checkLive/${channelId}] Checking...`);

  try {
    const res = await fetch(`https://www.youtube.com/channel/${channelId}/live`, {
      headers: browserHeaders(),
      redirect: "follow",
    });
    
    // If it didn't redirect to a /watch URL, they are likely NOT live (just showing the channel page)
    if (!res.url.includes('/watch?v=')) {
      console.log(`[checkLive/${channelId}] Method 1: No redirect to watch page (Not Live)`);
    } else {
      const html = await res.text();
      const videoId = res.url.match(/v=([a-zA-Z0-9_-]{11})/)?.[1];
      if (videoId && isActuallyLive(html, channelId, `Method 1 (${videoId})`)) {
        return { live: true, videoUrl: `https://www.youtube.com/watch?v=${videoId}`, title: extractTitle(html) };
      }
    }
  } catch (e: any) {
    console.error(`[checkLive/${channelId}] Method 1 failed: ${e.message}`);
  }

  try {
    const res = await fetch(`https://www.youtube.com/embed/live_stream?channel=${channelId}`, {
      headers: browserHeaders(),
    });
    const html = await res.text();
    const videoIdMatch = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    if (videoId && isActuallyLive(html, channelId, `Method 2 (${videoId})`)) {
      return { live: true, videoUrl: `https://www.youtube.com/watch?v=${videoId}`, title: "Live Stream" };
    }
  } catch (e: any) {
    console.error(`[checkLive/${channelId}] Method 2 failed: ${e.message}`);
  }

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
