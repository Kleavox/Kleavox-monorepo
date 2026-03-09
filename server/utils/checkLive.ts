// server/utils/checkLive.ts
import RSSParser from 'rss-parser'

const parser = new RSSParser({
  customFields: {
    feed: ['yt:channelId'],
  }
})

export function parseChannelInput(input: string) {
  // Strip whitespace dan trailing noise (koma, slash, dll)
  input = input.trim().replace(/[,\/\s]+$/, '')

  // https://www.youtube.com/@Handle atau http://youtube.com/@Handle
  const urlHandleMatch = input.match(/youtube\.com\/@([a-zA-Z0-9_.-]+)/i)
  if (urlHandleMatch) return { type: 'handle', value: urlHandleMatch[1] }

  // https://www.youtube.com/channel/UCxxxxxxx
  const urlChannelMatch = input.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/i)
  if (urlChannelMatch) return { type: 'id', value: urlChannelMatch[1] }

  // Raw channel ID: UC + 22 chars = 24 total
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(input)) return { type: 'id', value: input }

  // @Handle (tanpa URL)
  const bareHandleMatch = input.match(/^@([a-zA-Z0-9_.-]+)$/)
  if (bareHandleMatch) return { type: 'handle', value: bareHandleMatch[1] }

  // Raw handle tanpa @ (last resort)
  if (/^[a-zA-Z0-9_.-]{2,}$/.test(input)) return { type: 'handle', value: input }

  return null
}

export async function resolveChannelId(handle: string): Promise<{ channelId: string | null, debug: string[] }> {
  const debug: string[] = []

  // Strategy 1: RSS feed via ?user= (works for old-style usernames)
  try {
    debug.push(`[S1] Trying RSS ?user=${handle}`)
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?user=${handle}`
    const feed = await parser.parseURL(rssUrl) as any
    // feed.id contoh: "yt:channel:UCxxxxxx"
    const idStr = feed.id || ''
    const ucMatch = idStr.match(/(UC[a-zA-Z0-9_-]{22})/)
    if (ucMatch) {
      debug.push(`[S1] Found via feed.id: ${ucMatch[1]}`)
      return { channelId: ucMatch[1], debug }
    }
    // Fallback: cek yt:channelId custom field
    const ytChanId = (feed as any)['yt:channelId']
    if (ytChanId) {
      debug.push(`[S1] Found via yt:channelId: ${ytChanId}`)
      return { channelId: ytChanId, debug }
    }
  } catch (e: any) {
    debug.push(`[S1] Failed: ${e.message}`)
  }

  // Strategy 2: Scrape halaman @handle dengan browser-like headers
  try {
    debug.push(`[S2] Scraping youtube.com/@${handle}`)
    const res = await fetch(`https://www.youtube.com/@${handle}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cache-Control': 'no-cache',
      }
    })
    const html = await res.text()
    debug.push(`[S2] Got ${html.length} chars, status ${res.status}`)

    // Cari semua UC... di halaman, ambil yang pertama
    const patterns = [
      /"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/,
      /"externalId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/,
      /\/channel\/(UC[a-zA-Z0-9_-]{22})/,
      /"browseId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/,
      /"id"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/,
      /channel_id=(UC[a-zA-Z0-9_-]{22})/,
    ]
    for (const [i, pattern] of patterns.entries()) {
      const m = html.match(pattern)
      if (m) {
        debug.push(`[S2] Found via pattern ${i + 1}: ${m[1]}`)
        return { channelId: m[1], debug }
      }
    }
    debug.push(`[S2] No UC... found in ${html.length} chars`)
  } catch (e: any) {
    debug.push(`[S2] Failed: ${e.message}`)
  }

  // Strategy 3: Coba RSS feed dengan handle langsung (beberapa channel support ini)
  try {
    debug.push(`[S3] Trying RSS raw fetch for @${handle}`)
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?user=${handle}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const xml = await res.text()
    debug.push(`[S3] XML length: ${xml.length}`)
    const m = xml.match(/<yt:channelId>(UC[a-zA-Z0-9_-]{22})<\/yt:channelId>/)
    if (m) {
      debug.push(`[S3] Found: ${m[1]}`)
      return { channelId: m[1], debug }
    }
  } catch (e: any) {
    debug.push(`[S3] Failed: ${e.message}`)
  }

  debug.push('All strategies failed')
  return { channelId: null, debug }
}

export async function checkLive(channelId: string) {
  try {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    const feed = await parser.parseURL(feedUrl)
    for (const item of feed.items) {
      if (!item.title || !item.link) continue
      const videoId = item.link.match(/v=([a-zA-Z0-9_-]+)/)?.[1]
      if (!videoId) continue
      const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      })
      const html = await res.text()
      if (html.includes('"isLiveBroadcast":true') || html.includes('"isLive":true')) {
        return { live: true, videoUrl: item.link, title: item.title }
      }
    }
    return { live: false }
  } catch (err: any) {
    return { live: false, error: err.message }
  }
}
