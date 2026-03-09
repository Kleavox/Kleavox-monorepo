// server/utils/checkLive.ts
import RSSParser from 'rss-parser'

const parser = new RSSParser({
  customFields: { feed: ['yt:channelId'] }
})

export function parseChannelInput(input: string) {
  input = input.trim().replace(/[,\/\s]+$/, '')

  // https://www.youtube.com/@Handle
  const urlHandleMatch = input.match(/youtube\.com\/@([a-zA-Z0-9_.-]+)/i)
  if (urlHandleMatch) return { type: 'handle', value: urlHandleMatch[1] }

  // https://www.youtube.com/channel/UCxxxxxxx
  const urlChannelMatch = input.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/i)
  if (urlChannelMatch) return { type: 'id', value: urlChannelMatch[1] }

  // Raw channel ID: UC + exactly 22 chars = 24 total
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(input)) return { type: 'id', value: input }

  // @Handle tanpa URL
  const bareHandleMatch = input.match(/^@([a-zA-Z0-9_.-]+)$/)
  if (bareHandleMatch) return { type: 'handle', value: bareHandleMatch[1] }

  // Raw handle tanpa @
  if (/^[a-zA-Z0-9_.-]{2,}$/.test(input)) return { type: 'handle', value: input }

  return null
}

export async function resolveChannelId(handle: string): Promise<{ channelId: string | null, debug: string[] }> {
  const debug: string[] = []

  // Strategy 1: RSS ?user= — feed.id formatnya "yt:channel:UCxxxxxxx"
  // JANGAN pakai yt:channelId langsung karena isinya base64, bukan UC format
  try {
    debug.push(`[S1] Trying RSS ?user=${handle}`)
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?user=${handle}`
    const feed = await parser.parseURL(rssUrl) as any
    const idStr: string = feed.id || ''
    debug.push(`[S1] feed.id = "${idStr}"`)
    const ucMatch = idStr.match(/(UC[a-zA-Z0-9_-]{22})/)
    if (ucMatch) {
      debug.push(`[S1] Extracted UC from feed.id: ${ucMatch[1]}`)
      return { channelId: ucMatch[1], debug }
    }
    debug.push(`[S1] feed.id has no UC format, skipping yt:channelId (base64)`)
  } catch (e: any) {
    debug.push(`[S1] Failed: ${e.message}`)
  }

  // Strategy 2: Scrape youtube.com/@handle — cari UC... dengan beberapa pattern
  try {
    debug.push(`[S2] Scraping youtube.com/@${handle}`)
    const res = await fetch(`https://www.youtube.com/@${handle}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    })
    const html = await res.text()
    debug.push(`[S2] status=${res.status}, chars=${html.length}`)

    const patterns: [string, RegExp][] = [
      ['channelId',  /"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/],
      ['externalId', /"externalId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/],
      ['/channel/',  /\/channel\/(UC[a-zA-Z0-9_-]{22})/],
      ['browseId',   /"browseId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/],
      ['browse_id=', /browse_id=(UC[a-zA-Z0-9_-]{22})/],
      ['"id"',       /"id"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/],
    ]
    for (const [name, pat] of patterns) {
      const m = html.match(pat)
      if (m) {
        debug.push(`[S2] Found via "${name}": ${m[1]}`)
        return { channelId: m[1], debug }
      }
    }
    debug.push(`[S2] No UC... pattern matched`)
  } catch (e: any) {
    debug.push(`[S2] Failed: ${e.message}`)
  }

  // Strategy 3: RSS XML raw fetch — parse <yt:channelId> tag from XML
  // Ini berbeda dari S1: ambil raw XML dan parse <yt:channelId>UCxxxx</yt:channelId>
  try {
    debug.push(`[S3] Raw XML fetch ?user=${handle}`)
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?user=${handle}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const xml = await res.text()
    debug.push(`[S3] status=${res.status}, chars=${xml.length}`)
    // <yt:channelId> di dalam XML atom SELALU berformat UC... (bukan base64)
    const m = xml.match(/<yt:channelId>(UC[a-zA-Z0-9_-]{22})<\/yt:channelId>/)
    if (m) {
      debug.push(`[S3] Found via <yt:channelId> tag: ${m[1]}`)
      return { channelId: m[1], debug }
    }
    // Juga coba link rel=alternate yang mengandung channel_id
    const m2 = xml.match(/channel_id=(UC[a-zA-Z0-9_-]{22})/)
    if (m2) {
      debug.push(`[S3] Found via channel_id= in XML: ${m2[1]}`)
      return { channelId: m2[1], debug }
    }
    debug.push(`[S3] No UC... found in XML`)
  } catch (e: any) {
    debug.push(`[S3] Failed: ${e.message}`)
  }

  // Strategy 4: RSS via @handle URL (bukan ?user=)
  try {
    debug.push(`[S4] Raw XML fetch feeds?user via @handle path`)
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?forHandle=@${handle}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const xml = await res.text()
    debug.push(`[S4] status=${res.status}, chars=${xml.length}`)
    const m = xml.match(/<yt:channelId>(UC[a-zA-Z0-9_-]{22})<\/yt:channelId>/)
    if (m) {
      debug.push(`[S4] Found: ${m[1]}`)
      return { channelId: m[1], debug }
    }
    // feed.id dalam XML: <id>yt:channel:UCxxxxxx</id>
    const m2 = xml.match(/<id>yt:channel:(UC[a-zA-Z0-9_-]{22})<\/id>/)
    if (m2) {
      debug.push(`[S4] Found via <id> tag: ${m2[1]}`)
      return { channelId: m2[1], debug }
    }
    debug.push(`[S4] No UC... found`)
  } catch (e: any) {
    debug.push(`[S4] Failed: ${e.message}`)
  }

  debug.push('All strategies exhausted')
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
