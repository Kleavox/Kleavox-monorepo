// server/utils/watcherStore.ts

interface Watcher {
  channelId: string;
  channelInput: string;
  intervalId: ReturnType<typeof setInterval> | null;
  status: "waiting" | "live";
  videoUrl: string | null;
  title: string | null;
  createdAt: number;
}

declare global {
  var __watcherStore: Map<string, Watcher> | undefined;
  var __watcherCleanup: ReturnType<typeof setInterval> | undefined;
}

const store: Map<string, Watcher> = globalThis.__watcherStore ?? new Map();
globalThis.__watcherStore = store;

if (!globalThis.__watcherCleanup) {
  globalThis.__watcherCleanup = setInterval(
    () => {
      const now = Date.now();
      for (const [id, w] of store.entries()) {
        if (now - w.createdAt > 12 * 60 * 60 * 1000) {
          if (w.intervalId) clearInterval(w.intervalId);
          store.delete(id);
        }
      }
    },
    60 * 60 * 1000,
  );
}

export const watcherStore = store;
