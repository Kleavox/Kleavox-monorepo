<template>
  <main class="min-h-screen bg-void text-snow flex flex-col">

    <!-- Ambient glow top -->
    <div class="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] opacity-10 pointer-events-none"
      style="background: radial-gradient(ellipse at center top, #ff2d2d 0%, transparent 70%);" />

    <!-- Header -->
    <header class="relative z-10 px-8 py-6 flex items-center justify-between border-b border-smoke">
      <div class="font-display text-2xl tracking-widest2 text-snow">
        DEAU<span class="text-signal">WAIT</span>
      </div>
      <div class="font-mono text-xs text-ghost tracking-widest uppercase">
        YT Live Watcher
      </div>
    </header>

    <!-- Main content -->
    <div class="flex-1 flex flex-col items-center justify-center px-4 py-20">

      <!-- Title block -->
      <div class="text-center mb-16 animate-fade-up">
        <p class="font-mono text-xs text-ghost tracking-widest3 uppercase mb-4">
          — tunggu sampai live —
        </p>
        <h1 class="font-display text-[clamp(4rem,12vw,10rem)] leading-none tracking-widest text-snow relative">
          STANDBY
        </h1>
        <div class="mt-3 h-px w-48 mx-auto bg-gradient-to-r from-transparent via-signal to-transparent" />
      </div>

      <!-- Input form -->
      <div class="w-full max-w-lg animate-fade-up" style="animation-delay: 0.15s; opacity: 0;">
        <div class="relative group">
          <!-- Label -->
          <label class="block font-mono text-xs text-ghost tracking-widest uppercase mb-3">
            Channel YouTube
          </label>

          <!-- Input wrapper -->
          <div class="relative border border-smoke group-focus-within:border-signal transition-colors duration-300"
            style="background: rgba(26,26,26,0.8);">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-ghost text-sm">@</span>
            <input
              v-model="channelInput"
              type="text"
              placeholder="handle, URL, atau channel ID"
              class="w-full py-4 pl-8 pr-4 font-mono text-sm text-snow placeholder-mist bg-transparent"
              :disabled="isLoading"
              @keydown.enter="startWatching"
            />
            <div class="absolute inset-0 pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity duration-300"
              style="box-shadow: inset 0 0 20px rgba(255,45,45,0.05);" />
          </div>

          <!-- Hint -->
          <p class="mt-2 font-mono text-xs text-ghost">
            Contoh: @lofi, youtube.com/@MrBeast, UC...
          </p>
        </div>

        <!-- Submit button -->
        <button
          @click="startWatching"
          :disabled="isLoading || !channelInput.trim()"
          class="mt-6 w-full py-4 font-display text-xl tracking-widest2 uppercase transition-all duration-300 relative overflow-hidden"
          :class="isLoading || !channelInput.trim()
            ? 'bg-smoke text-ghost cursor-not-allowed'
            : 'bg-signal text-void hover:bg-snow cursor-pointer'"
        >
          <span v-if="!isLoading">MULAI TUNGGU</span>
          <span v-else class="flex items-center justify-center gap-3">
            <span class="inline-block w-4 h-4 border-2 border-void border-t-transparent rounded-full animate-spin" />
            MENGHUBUNGKAN...
          </span>
        </button>

        <!-- Error -->
        <div v-if="error" class="mt-4 p-4 border border-signal-dim bg-signal-glow font-mono text-xs text-signal">
          ⚠ {{ error }}
        </div>
      </div>

      <!-- Active watchers -->
      <div v-if="activeWatchers.length" class="mt-16 w-full max-w-lg">
        <div class="flex items-center gap-3 mb-4">
          <div class="h-px flex-1 bg-smoke" />
          <span class="font-mono text-xs text-ghost tracking-widest uppercase">Aktif</span>
          <div class="h-px flex-1 bg-smoke" />
        </div>

        <div class="space-y-2">
          <WatcherCard
            v-for="w in activeWatchers"
            :key="w.watchId"
            :watcher="w"
            @remove="removeWatcher"
          />
        </div>
      </div>

    </div>

    <!-- Footer -->
    <footer class="relative z-10 px-8 py-4 border-t border-smoke flex items-center justify-between">
      <span class="font-mono text-xs text-mist">deauwait v2</span>
      <span class="font-mono text-xs text-mist">port 3001</span>
    </footer>

  </main>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const channelInput = ref('')
const isLoading = ref(false)
const error = ref('')
const activeWatchers = ref([])

// Load saved watchers from localStorage
onMounted(() => {
  try {
    const saved = localStorage.getItem('deau-watchers')
    if (saved) activeWatchers.value = JSON.parse(saved)
  } catch {}
  startPolling()
})

let pollInterval = null

function startPolling() {
  pollInterval = setInterval(pollWatchers, 15_000)
}

onUnmounted(() => {
  clearInterval(pollInterval)
})

async function startWatching() {
  if (!channelInput.value.trim() || isLoading.value) return
  error.value = ''
  isLoading.value = true

  try {
    const data = await $fetch('/api/watch', {
      method: 'POST',
      body: { channel: channelInput.value.trim() }
    })

    const watcher = {
      watchId: data.watchId,
      channelInput: channelInput.value.trim(),
      status: data.status,
      videoUrl: data.videoUrl,
      startedAt: Date.now()
    }

    activeWatchers.value.unshift(watcher)
    saveWatchers()
    channelInput.value = ''

    if (data.status === 'live' && data.videoUrl) {
      setTimeout(() => {
        window.location.href = data.videoUrl
      }, 2000)
    }
  } catch (e) {
    error.value = e.data?.message || e.message || 'Gagal memulai watcher'
  } finally {
    isLoading.value = false
  }
}

async function pollWatchers() {
  for (const w of activeWatchers.value) {
    if (w.status === 'live') continue
    try {
      const data = await $fetch(`/api/status/${w.watchId}`)
      w.status = data.status
      w.videoUrl = data.videoUrl
      if (data.status === 'live' && data.videoUrl) {
        saveWatchers()
        setTimeout(() => {
          window.location.href = data.videoUrl
        }, 3000)
      }
    } catch {}
  }
  saveWatchers()
}

async function removeWatcher(watchId) {
  try {
    await $fetch(`/api/watch/${watchId}`, { method: 'DELETE' })
  } catch {}
  activeWatchers.value = activeWatchers.value.filter(w => w.watchId !== watchId)
  saveWatchers()
}

function saveWatchers() {
  try {
    localStorage.setItem('deau-watchers', JSON.stringify(activeWatchers.value))
  } catch {}
}
</script>
