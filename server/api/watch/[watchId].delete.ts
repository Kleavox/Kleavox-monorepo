// server/api/watch/[watchId].delete.ts
import { watcherStore } from '../../utils/watcherStore'

export default defineEventHandler((event) => {
  const watchId = getRouterParam(event, 'watchId')
  if (!watchId) throw createError({ statusCode: 400, message: 'watchId required' })

  const watcher = watcherStore.get(watchId)
  if (watcher && watcher.intervalId) {
    clearInterval(watcher.intervalId)
  }

  watcherStore.delete(watchId)
  return { success: true }
})
