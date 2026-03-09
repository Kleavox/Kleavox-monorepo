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

// Extract semua UC... dari HTML, lalu verifikasi mana yang benar-benar
// milik channel ini dengan cek RSS feed-nya
async function verifyChannelId(candidateId: string, handle: string): Promise<boolean> {
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${candidateId}`
    const res = await fetch(rssUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) return false
    const xml = await res.text()
    // RSS feed yang valid punya <author> atau <title> yang mengandung nama channel
    // Minimal, cukup cek feed berhasil di-load (status 200 + ada yt:channelId)
    return xml.includes('<yt:channelId>') || xml.includes('<entry>')
  } catch {
    return false
  }
}

export async function resolveChannelId(handle: string): Promise<{ channelId: string | null, debug: string[] }> {
  const debug: string[] = []

  // Strategy 1: forHandle parameter (paling akurat untuk @handle baru)
  try {
    debug.push(`[S1] RSS ?forHandle=@${handle}`)
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?forHandle=@${handle}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const xml = await res.text()
    debug.push(`[S1] status=${res.status}, chars=${xml.length}`)
    // <id>yt:channel:UCxxxxxx</id>
    const m1 = xml.match(/<id>yt:channel:(UC[a-zA-Z0-9_-]{22})<\/id>/)
    if (m1) { debug.push(`[S1] Found via <id>: ${m1[1]}`); return { channelId: m1[1], debug } }
    const m2 = xml.match(/<yt:channelId>(UC[a-zA-Z0-9_-]{22})<\/yt:channelId>/)
    if (m2) { debug.push(`[S1] Found via <yt:channelId>: ${m2[1]}`); return { channelId: m2[1], debug } }
    debug.push(`[S1] No UC found`)
  } catch (e: any) { debug.push(`[S1] Failed: ${e.message}`) }

  // Strategy 2: RSS ?user= lama
  try {
    debug.push(`[S2] RSS ?user=${handle}`)
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?user=${handle}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const xml = await res.text()
    debug.push(`[S2] status=${res.status}, chars=${xml.length}`)
    const m1 = xml.match(/<id>yt:channel:(UC[a-zA-Z0-9_-]{22})<\/id>/)
    if (m1) { debug.push(`[S2] Found via <id>: ${m1[1]}`); return { channelId: m1[1], debug } }
    const m2 = xml.match(/<yt:channelId>(UC[a-zA-Z0-9_-]{22})<\/yt:channelId>/)
    if (m2) { debug.push(`[S2] Found via <yt:channelId>: ${m2[1]}`); return { channelId: m2[1], debug } }
    debug.push(`[S2] No UC found`)
  } catch (e: any) { debug.push(`[S2] Failed: ${e.message}`) }

  // Strategy 3: Scrape halaman @handle — ambil SEMUA UC candidate, verifikasi satu per satu
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

    // Prioritas tinggi: externalId dan browseId — ini hampir pasti milik channel itu sendiri
    const highPriority: [string, RegExp][] = [
      ['externalId', /"externalId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/],
      ['browseId',   /"browseId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/],
    ]
    for (const [name, pat] of highPriority) {
      const m = html.match(pat)
      if (m) {
        debug.push(`[S3] High-priority "${name}": ${m[1]}, verifying...`)
        const ok = await verifyChannelId(m[1], handle)
        debug.push(`[S3] Verify result: ${ok}`)
        if (ok) return { channelId: m[1], debug }
      }
    }

    // Prioritas rendah: ambil semua UC candidate, verifikasi satu per satu
    // Prioritaskan yang dekat dengan canonical URL channel di head
    const canonicalMatch = html.match(/rel="canonical"\s+href="[^"]*\/channel\/(UC[a-zA-Z0-9_-]{22})"/)
    if (canonicalMatch) {
      debug.push(`[S3] Canonical tag: ${canonicalMatch[1]}, verifying...`)
      const ok = await verifyChannelId(canonicalMatch[1], handle)
      if (ok) { debug.push(`[S3] Verified canonical`); return { channelId: canonicalMatch[1], debug } }
    }

    // Ambil semua unique UC..., coba verifikasi (max 3 kandidat)
    const allUC = [...new Set([...html.matchAll(/(UC[a-zA-Z0-9_-]{22})/g)].map(m => m[1]))]
    debug.push(`[S3] Found ${allUC.length} unique UC candidates`)
    for (const uc of allUC.slice(0, 5)) {
      const ok = await verifyChannelId(uc, handle)
      if (ok) {
        debug.push(`[S3] Verified: ${uc}`)
        return { channelId: uc, debug }
      }
    }
    debug.push(`[S3] None verified`)
  } catch (e: any) { debug.push(`[S3] Failed: ${e.message}`) }

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
