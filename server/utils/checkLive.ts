// server/utils/checkLive.ts
import RSSParser from 'rss-parser'

const parser = new RSSParser({
  customFields: { feed: ['yt:channelId'] }
})

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
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    if (!res.ok) return false
    const xml = await res.text()
    return xml.includes('<yt:channelId>') || xml.includes('<entry>')
  } catch {
    return false
  }
}

export async function resolveChannelId(handle: string): Promise<{ channelId: string | null, debug: string[] }> {
  const debug: string[] = []

  // S1: forHandle parameter
  try {
    debug.push(`[S1] RSS ?forHandle=@${handle}`)
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?forHandle=@${handle}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const xml = await res.text()
    debug.push(`[S1] status=${res.status}, chars=${xml.length}`)
    const m1 = xml.match(/<id>yt:channel:(UC[a-zA-Z0-9_-]{22})<\/id>/)
    if (m1) { debug.push(`[S1] Found: ${m1[1]}`); return { channelId: m1[1], debug } }
    const m2 = xml.match(/<yt:channelId>(UC[a-zA-Z0-9_-]{22})<\/yt:channelId>/)
    if (m2) { debug.push(`[S1] Found: ${m2[1]}`); return { channelId: m2[1], debug } }
  } catch (e: any) { debug.push(`[S1] Failed: ${e.message}`) }

  // S2: ?user= legacy
  try {
    debug.push(`[S2] RSS ?user=${handle}`)
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?user=${handle}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const xml = await res.text()
    debug.push(`[S2] status=${res.status}, chars=${xml.length}`)
    const m1 = xml.match(/<id>yt:channel:(UC[a-zA-Z0-9_-]{22})<\/id>/)
    if (m1) { debug.push(`[S2] Found: ${m1[1]}`); return { channelId: m1[1], debug } }
    const m2 = xml.match(/<yt:channelId>(UC[a-zA-Z0-9_-]{22})<\/yt:channelId>/)
    if (m2) { debug.push(`[S2] Found: ${m2[1]}`); return { channelId: m2[1], debug } }
  } catch (e: any) { debug.push(`[S2] Failed: ${e.message}`) }

  // S3: Scrape + verify
  try {
    debug.push(`[S3] Scraping youtube.com/@${handle}`)
    const res = await fetch(`https://www.youtube.com/@${handle}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    })
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

      // Must be actively live — exclude premiers and scheduled streams
      // "isLive":true = currently broadcasting
      // "isLiveBroadcast":true can be true for premiers too, so check more carefully
      const isActuallyLive = html.includes('"isLive":true')

      // Double-check: not an upcoming/premier
      // Premiers have "isLiveContent":true but "isUpcoming":true
      const isUpcoming = html.includes('"isUpcoming":true')
      const isPremiere = html.includes('"premiereTimestamp"')

      if (isActuallyLive && !isUpcoming && !isPremiere) {
        return { live: true, videoUrl: item.link, title: item.title }
      }
    }
    return { live: false }
  } catch (err: any) {
    return { live: false, error: err.message }
  }
}
