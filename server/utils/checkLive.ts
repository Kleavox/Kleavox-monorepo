// server/utils/checkLive.ts
import RSSParser from 'rss-parser'

const parser = new RSSParser({ customFields: { feed: ['yt:channelId'] } })

// Rotate user agents to reduce bot detection on server IPs
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
]

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

function browserHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'User-Agent': randomUA(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Upgrade-Insecure-Requests': '1',
    ...extra,
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export function parseChannelInput(input: string) {
  input = input.trim().replace(/[,\/\s]+$/, '')

  const urlHandleMatch = input.match(/youtube\.com\/@([a-zA-Z0-9_.-]+)/i)
  if (urlHandleMatch) return { type: 'handle', value: urlHandleMatch[1] }

  const urlChannelMatch = input.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/i)
  if (urlChannelMatch) return { type: 'id', value: urlChannelMatch[1] }

  if (/^UC[a-zA-Z0-9_-]{22}$/.test(input)) return { type: 'id', value: input }

  const bareHandleMatch = input.match(/^@([a-zA-Z0-9_.-]+)$/)
  if (bareHandleMatch) return { type: 'handle', value: bareHandleMatch[1] }

  if (/^[a-zA-Z0-9_.-]{2,}$/.test(input)) return { type: 'handle', value: input }

  return null
}

async function verifyChannelId(candidateId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${candidateId}`,
      { headers: { 'User-Agent': randomUA() } }
    )
    if (!res.ok) return false
    const xml = await res.text()
    return xml.includes('<yt:channelId>') || xml.includes('<entry>')
  } catch { return false }
}

export async function resolveChannelId(handle: string): Promise<{ channelId: string | null, debug: string[] }> {
  const debug: string[] = []

  try {
    debug.push(`[S1] RSS ?forHandle=@${handle}`)
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?forHandle=@${handle}`, { headers: { 'User-Agent': randomUA() } })
    const xml = await res.text()
    debug.push(`[S1] status=${res.status}, chars=${xml.length}`)
    const m1 = xml.match(/<id>yt:channel:(UC[a-zA-Z0-9_-]{22})<\/id>/)
    if (m1) { debug.push(`[S1] Found: ${m1[1]}`); return { channelId: m1[1], debug } }
    const m2 = xml.match(/<yt:channelId>(UC[a-zA-Z0-9_-]{22})<\/yt:channelId>/)
    if (m2) { debug.push(`[S1] Found: ${m2[1]}`); return { channelId: m2[1], debug } }
  } catch (e: any) { debug.push(`[S1] Failed: ${e.message}`) }

  try {
    debug.push(`[S2] RSS ?user=${handle}`)
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?user=${handle}`, { headers: { 'User-Agent': randomUA() } })
    const xml = await res.text()
    debug.push(`[S2] status=${res.status}, chars=${xml.length}`)
    const m1 = xml.match(/<id>yt:channel:(UC[a-zA-Z0-9_-]{22})<\/id>/)
    if (m1) { debug.push(`[S2] Found: ${m1[1]}`); return { channelId: m1[1], debug } }
    const m2 = xml.match(/<yt:channelId>(UC[a-zA-Z0-9_-]{22})<\/yt:channelId>/)
    if (m2) { debug.push(`[S2] Found: ${m2[1]}`); return { channelId: m2[1], debug } }
  } catch (e: any) { debug.push(`[S2] Failed: ${e.message}`) }

  try {
    debug.push(`[S3] Scraping youtube.com/@${handle}`)
    const res = await fetch(`https://www.youtube.com/@${handle}`, { headers: browserHeaders() })
    const html = await res.text()
    debug.push(`[S3] status=${res.status}, chars=${html.length}`)

    for (const [name, pat] of [
      ['externalId', /"externalId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/],
      ['browseId',   /"browseId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/],
    ] as [string, RegExp][]) {
      const m = html.match(pat)
      if (m) {
        const ok = await verifyChannelId(m[1])
        debug.push(`[S3] "${name}": ${m[1]}, verify=${ok}`)
        if (ok) return { channelId: m[1], debug }
      }
    }

    const canonical = html.match(/rel="canonical"\s+href="[^"]*\/channel\/(UC[a-zA-Z0-9_-]{22})"/)
    if (canonical) {
      const ok = await verifyChannelId(canonical[1])
      if (ok) { debug.push(`[S3] canonical: ${canonical[1]}`); return { channelId: canonical[1], debug } }
    }

    const allUC = [...new Set([...html.matchAll(/(UC[a-zA-Z0-9_-]{22})/g)].map(m => m[1]))]
    for (const uc of allUC.slice(0, 5)) {
      const ok = await verifyChannelId(uc)
      if (ok) { debug.push(`[S3] verified: ${uc}`); return { channelId: uc, debug } }
    }
  } catch (e: any) { debug.push(`[S3] Failed: ${e.message}`) }

  return { channelId: null, debug }
}

// ─────────────────────────────────────────────────────────────────────────────
// Live detection
// ─────────────────────────────────────────────────────────────────────────────

function extractVideoId(html: string): string | null {
  for (const p of [
    /"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/,
    /watch\?v=([a-zA-Z0-9_-]{11})/,
    /"identifier"\s*:\s*"([a-zA-Z0-9_-]{11})"/,
  ]) {
    const m = html.match(p)
    if (m) return m[1]
  }
  return null
}

function extractTitle(html: string): string {
  const m = html.match(/<title>([^<]+)<\/title>/)
  return m ? m[1].replace(/ - YouTube$/, '').trim() : 'Live Stream'
}

// Verify a specific video ID is actually live right now
async function verifyVideoLive(videoId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: browserHeaders()
    })
    const html = await res.text()

    // Not live if:
    if (html.includes('"isUpcoming":true')) return false
    if (html.includes('"premiereTimestamp"')) return false

    // Positive: must be actively broadcasting
    // hlsManifestUrl is the strongest signal — only present during active stream delivery
    // streamingData present + isLive:true is also reliable
    const isLive = html.includes('"isLive":true')
    const hasHLS = html.includes('"hlsManifestUrl"')
    const hasStreaming = html.includes('"streamingData"') && isLive

    console.log(`[verify/${videoId}] isLive=${isLive} hlsManifest=${hasHLS} streamingData=${html.includes('"streamingData"')}`)

    return hasHLS || hasStreaming
  } catch (e: any) {
    console.log(`[verify/${videoId}] failed: ${e.message}`)
    return false
  }
}

export async function checkLive(channelId: string) {
  // ── Method 1: /channel/{id}/live redirect ─────────────────────────────────
  // YouTube redirects this URL to /watch?v=XXX ONLY when the channel is live.
  // The redirect itself is the primary signal — more reliable than scraping JS.
  try {
    const res = await fetch(`https://www.youtube.com/channel/${channelId}/live`, {
      headers: browserHeaders(),
      redirect: 'follow',
    })
    const finalUrl = res.url
    const html = await res.text()

    console.log(`[live/${channelId}] /live → ${finalUrl} (${html.length} chars)`)

    // If YouTube redirected to a /watch?v= URL, there's likely a live stream
    const watchMatch = finalUrl.match(/watch\?v=([a-zA-Z0-9_-]{11})/)
    if (watchMatch) {
      const videoId = watchMatch[1]
      console.log(`[live/${channelId}] Redirect to watch page detected, verifying video ${videoId}...`)
      const confirmed = await verifyVideoLive(videoId)
      if (confirmed) {
        console.log(`[live/${channelId}] ✓ CONFIRMED LIVE: ${finalUrl}`)
        return { live: true, videoUrl: finalUrl, title: extractTitle(html) }
      }
      console.log(`[live/${channelId}] Redirect to watch page but video not confirmed live (ended/upcoming)`)
    }

    // Fallback: no redirect but page itself might have live data
    // (some channels serve the live page without redirecting)
    if (html.includes('"isLive":true') && html.includes('"hlsManifestUrl"')) {
      const videoId = extractVideoId(html)
      if (videoId) {
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
        console.log(`[live/${channelId}] ✓ LIVE via page signals: ${videoUrl}`)
        return { live: true, videoUrl, title: extractTitle(html) }
      }
    }
  } catch (e: any) {
    console.log(`[live/${channelId}] /live endpoint error: ${e.message}`)
  }

  // ── Method 2: RSS feed ────────────────────────────────────────────────────
  // Check recent videos — live streams appear here when active
  try {
    const feed = await parser.parseURL(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    )
    for (const item of feed.items) {
      if (!item.title || !item.link) continue
      const videoId = item.link.match(/v=([a-zA-Z0-9_-]+)/)?.[1]
      if (!videoId) continue
      const confirmed = await verifyVideoLive(videoId)
      if (confirmed) {
        console.log(`[live/${channelId}] ✓ LIVE via RSS: ${item.link}`)
        return { live: true, videoUrl: item.link, title: item.title }
      }
    }
  } catch (e: any) {
    console.log(`[live/${channelId}] RSS error: ${e.message}`)
  }

  return { live: false }
}
