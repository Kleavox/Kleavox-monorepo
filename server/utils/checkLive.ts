// server/utils/checkLive.ts
import RSSParser from 'rss-parser'

const parser = new RSSParser()

export function parseChannelInput(input: string) {
  input = input.trim()
  const handleMatch = input.match(/(?:youtube\.com\/@|^@?)([a-zA-Z0-9_.-]+)/)
  if (handleMatch && input.includes('@')) return { type: 'handle', value: handleMatch[1] }
  const channelMatch = input.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/)
  if (channelMatch) return { type: 'id', value: channelMatch[1] }
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(input)) return { type: 'id', value: input }
  if (/^[a-zA-Z0-9_.-]+$/.test(input)) return { type: 'handle', value: input }
  return null
}

export async function resolveChannelId(handle: string): Promise<string | null> {
  try {
    const feedUrl = `https://www.youtube.com/@${handle}/videos`
    const pageRes = await fetch(feedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DeauWait/2.0)' }
    })
    const html = await pageRes.text()
    const match = html.match(/"channelId":"(UC[a-zA-Z0-9_-]+)"/)
    return match ? match[1] : null
  } catch {
    return null
  }
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
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DeauWait/2.0)' }
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
