// server/api/watch.post.ts
import { parseChannelInput, resolveChannelId, checkLive } from '../utils/checkLive'
import { watcherStore } from '../utils/watcherStore'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { channel } = body

  if (!channel) {
    throw createError({ statusCode: 400, message: 'channel is required' })
  }

  const parsed = parseChannelInput(channel)
  if (!parsed) {
    throw createError({ statusCode: 400, message: 'Format channel tidak valid' })
  }

  let channelId = parsed.value
  if (parsed.type === 'handle') {
    const resolved = await resolveChannelId(parsed.value)
    if (!resolved) {
      throw createError({ statusCode: 404, message: 'Channel tidak ditemukan' })
    }
    channelId = resolved
  }

  const watchId = Math.random().toString(36).slice(2, 10)

  // Check immediately
  const immediate = await checkLive(channelId)

  // Start polling every 2 minutes
  const intervalId = setInterval(async () => {
    const result = await checkLive(channelId)
    const watcher = watcherStore.get(watchId)
    if (!watcher) return
    if (result.live) {
      watcher.status = 'live'
      watcher.videoUrl = result.videoUrl ?? null
      watcher.title = result.title ?? null
      clearInterval(intervalId)
    }
  }, 2 * 60 * 1000)

  watcherStore.set(watchId, {
    channelId,
    channelInput: channel,
    intervalId,
    status: immediate.live ? 'live' : 'waiting',
    videoUrl: immediate.live ? (immediate.videoUrl ?? null) : null,
    title: immediate.live ? (immediate.title ?? null) : null,
    createdAt: Date.now()
  })

  return {
    watchId,
    status: immediate.live ? 'live' : 'waiting',
    videoUrl: immediate.live ? immediate.videoUrl : null
  }
})
