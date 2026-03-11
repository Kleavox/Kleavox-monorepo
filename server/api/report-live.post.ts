// server/api/report-live.post.ts
import { watcherStore } from '../utils/watcherStore'
import { isActuallyLive, extractTitle } from '../utils/checkLive'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { watchId, videoId } = body

  if (!watchId || !videoId) {
    throw createError({ statusCode: 400, message: 'watchId and videoId required' })
  }

  const watcher = watcherStore.get(watchId)
  if (!watcher || watcher.status === 'live') return { success: true }

  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`)
    const html = await res.text()

    if (isActuallyLive(html, watcher.channelId, `Client Report (${videoId})`)) {
      watcher.status = 'live'
      watcher.videoUrl = `https://www.youtube.com/watch?v=${videoId}`
      watcher.title = extractTitle(html)
      if (watcher.intervalId) {
        clearInterval(watcher.intervalId)
        watcher.intervalId = null
      }
      console.log(`[report-live] Watcher ${watchId} updated to LIVE via client report`)
      return { success: true }
    }
  } catch (e: any) {
    console.error(`[report-live] Verification failed: ${e.message}`)
  }

  return { success: false }
})
