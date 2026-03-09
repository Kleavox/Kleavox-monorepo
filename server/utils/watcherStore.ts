// server/utils/watcherStore.ts
// Global in-process store for active watchers
// Nitro runs in a single process, so Map survives between requests

interface Watcher {
  channelId: string
  channelInput: string
  intervalId: ReturnType<typeof setInterval> | null
  status: 'waiting' | 'live'
  videoUrl: string | null
  title: string | null
  createdAt: number
}

// @ts-ignore - global singleton
const store: Map<string, Watcher> = globalThis.__watcherStore ?? new Map()
// @ts-ignore
globalThis.__watcherStore = store

// Auto-cleanup stale watchers older than 12 hours
if (!globalThis.__watcherCleanup) {
  // @ts-ignore
  globalThis.__watcherCleanup = setInterval(() => {
    const now = Date.now()
    for (const [id, w] of store.entries()) {
      if (now - w.createdAt > 12 * 60 * 60 * 1000) {
        if (w.intervalId) clearInterval(w.intervalId)
        store.delete(id)
      }
    }
  }, 60 * 60 * 1000)
}

export const watcherStore = store
