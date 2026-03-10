// server/api/status/[watchId].get.ts

import { watcherStore } from '../../utils/watcherStore'

export default defineEventHandler((event) => {
  const watchId = getRouterParam(event, 'watchId')
  if (!watchId) throw createError({ statusCode: 400, message: 'watchId required' })

  const watcher = watcherStore.get(watchId)
  if (!watcher) throw createError({ statusCode: 404, message: 'Watcher not found' })

  return {
    status: watcher.status,
    videoUrl: watcher.videoUrl,
    title: watcher.title,
    channelInput: watcher.channelInput,
    age: Math.floor((Date.now() - watcher.createdAt) / 1000)
  }
})
