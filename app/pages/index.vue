// app/pages/index.vue
<template>
  <main class="min-h-screen text-snow flex flex-col relative overflow-hidden">
    
    <div class="amoled-bg">
      <div class="amoled-glow"></div>
      <div class="amoled-glow-2"></div>
      <BackgroundParticles :count="120" />
    </div>

    <header class="relative z-10 px-6 py-6 flex items-center justify-between glass-panel border-b-0 m-4 rounded-2xl">
      <div class="flex items-center gap-4">
        <div class="w-10 h-10 relative">
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="w-full h-full">
            <path fill="currentColor" d="M 22,15 L 65,15 C 92,15 98,35 98,50 C 98,65 92,85 58,85 L 15,85 L 23,70 L 58,70 C 78,70 82,60 82,50 C 82,40 78,30 65,30 L 30,30 Z" />
            <g transform="translate(82, 22)">
              <g stroke="#ff2d2d" stroke-width="8" stroke-linecap="round">
                <line x1="0" y1="-18" x2="0" y2="-11" />
                <line x1="0" y1="11" x2="0" y2="18" />
                <line x1="-18" y1="0" x2="-11" y2="0" />
                <line x1="11" y1="0" x2="18" y2="0" />
              </g>
              <circle cx="0" cy="0" r="10" fill="#ff2d2d" />
              <circle cx="0" cy="0" r="4" fill="white" />
            </g>
          </svg>
        </div>
        <div class="font-display text-2xl tracking-widest2 text-snow">
          DEAU<span class="text-signal">WAIT</span>
        </div>
      </div>
      
      <div class="flex items-center gap-4">
        <button 
          @click="toggleFullscreen" 
          class="p-2.5 rounded-xl hover:bg-white/5 transition-colors border border-white/10 group"
          title="Toggle Fullscreen"
        >
          <svg v-if="!isFullscreen" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-ghost group-hover:text-snow"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-ghost group-hover:text-snow"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
        </button>
        <div class="hidden sm:block font-mono text-[10px] text-ghost tracking-widest uppercase border border-white/10 px-3 py-1.5 rounded-lg">
          v4.0.0
        </div>
      </div>
    </header>

    <div class="flex-1 flex flex-col items-center justify-center px-4 py-10">

      <div class="text-center mb-12 animate-fade-up w-full">
        <p class="font-mono text-[10px] sm:text-xs text-ghost tracking-widest3 uppercase mb-4">
          — standby for broadcast —
        </p>
        <h1 class="font-display leading-none tracking-widest text-snow"
          style="font-size: clamp(3.5rem, 15vw, 9rem); text-shadow: 0 0 40px rgba(255,255,255,0.05);">
          WAITING ROOM
        </h1>
      </div>

      <div class="w-full max-w-lg glass-panel p-6 sm:p-8 rounded-3xl animate-fade-up" style="animation-delay: 0.15s; opacity: 0;">

        <label class="block font-mono text-[10px] sm:text-xs text-ghost tracking-widest uppercase mb-4 ml-1">
          Target Channel
        </label>

        <div class="relative group">
          <div class="absolute -inset-0.5 bg-gradient-to-r from-signal/20 to-signal/5 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
          <div class="relative border border-white/10 focus-within:border-signal/50 transition-all duration-300 rounded-2xl overflow-hidden bg-black/40 backdrop-blur-md">
            <input
              v-model="channelInput"
              type="text"
              placeholder="@handle, URL, or channel ID..."
              class="w-full py-4 sm:py-5 px-5 font-mono text-sm text-snow placeholder-white/20 bg-transparent"
              :disabled="isLoading"
              autocomplete="off"
              @keydown.enter="startWatching"
            />
          </div>
        </div>

        <div v-if="recentChannels.length" class="mt-6 ml-1">
          <p class="font-mono text-[9px] text-mist tracking-widest uppercase mb-3">Recently Watched</p>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="ch in recentChannels"
              :key="ch"
              class="flex items-center gap-0 border border-white/5 hover:border-signal/30 transition-all group rounded-xl overflow-hidden"
              style="background: rgba(255,255,255,0.02);"
            >
              <button
                @click="channelInput = ch"
                class="font-mono text-[10px] text-ghost group-hover:text-snow transition-colors px-3 py-2"
              >
                {{ ch }}
              </button>
              <button
                @click.stop="removeRecent(ch)"
                class="font-mono text-[10px] text-white/10 hover:text-signal transition-colors px-2 py-2 border-l border-white/5 hover:bg-signal/5"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        <button
          @click="startWatching"
          :disabled="isLoading || !channelInput.trim()"
          class="mt-8 w-full py-4 sm:py-5 font-display text-xl tracking-widest2 uppercase transition-all duration-500 rounded-2xl overflow-hidden relative group"
          :class="isLoading || !channelInput.trim()
            ? 'bg-white/5 text-ghost cursor-not-allowed'
            : 'bg-snow text-void hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-[0.98]'"
        >
          <span v-if="!isLoading" class="relative z-10">INITIALIZE WATCHER</span>
          <span v-else class="flex items-center justify-center gap-3 relative z-10">
            <span class="inline-block w-5 h-5 border-2 border-void border-t-transparent rounded-full animate-spin" />
            CONNECTING...
          </span>
          <div v-if="!isLoading && channelInput.trim()" class="absolute inset-0 bg-signal translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
        </button>

        <div v-if="error" class="mt-4 p-4 border border-signal/20 rounded-2xl font-mono text-xs text-signal bg-signal/5 animate-shake">
          <span class="font-bold">⚠ ERROR:</span> {{ error }}
        </div>

        <div v-if="lastOpened" class="mt-4 p-4 border border-white/10 rounded-2xl font-mono text-xs text-ghost bg-white/5 flex items-center justify-between">
          <span>Watcher active.</span>
          <NuxtLink :to="lastOpened" class="text-signal hover:underline uppercase tracking-widest text-[10px]">Resume Monitoring →</NuxtLink>
        </div>

      </div>
    </div>

    <footer class="relative z-10 m-4 rounded-2xl glass-panel p-6">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-6">
        <div class="flex items-center gap-6">
          <div class="flex items-center gap-3">
            <div class="w-2 h-2 rounded-full bg-signal animate-pulse shadow-[0_0_10px_rgba(255,45,45,0.5)]"></div>
            <span class="font-mono text-[10px] text-ghost tracking-widest uppercase">Engine Active</span>
          </div>
          <div class="h-4 w-px bg-white/10 hidden sm:block"></div>
          <div class="flex items-center gap-3 font-mono text-[10px] text-ghost">
            <span class="tracking-widest uppercase">Cluster · Global</span>
          </div>
        </div>
        
        <div class="flex items-center gap-6 font-mono text-[10px] text-mist">
          <span class="tracking-widest uppercase hover:text-snow transition-colors cursor-default">Deau.site</span>
          <span class="text-white/5">/</span>
          <span class="tracking-widest uppercase text-mist">© {{ new Date().getFullYear() }}</span>
        </div>
      </div>
    </footer>

  </main>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const channelInput = ref('')
const isLoading = ref(false)
const error = ref('')
const lastOpened = ref(null)
const recentChannels = ref([])
const isFullscreen = ref(false)

const MAX_RECENT = 6

onMounted(() => {
  try {
    const saved = localStorage.getItem('deau-recent')
    if (saved) recentChannels.value = JSON.parse(saved)
  } catch {}
  
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })
})

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.error(`Error attempting to enable full-screen mode: ${err.message}`)
    })
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen()
    }
  }
}

function addRecent(channel) {
  const filtered = recentChannels.value.filter(c => c !== channel)
  recentChannels.value = [channel, ...filtered].slice(0, MAX_RECENT)
  try {
    localStorage.setItem('deau-recent', JSON.stringify(recentChannels.value))
  } catch {}
}

function removeRecent(channel) {
  recentChannels.value = recentChannels.value.filter(c => c !== channel)
  try {
    localStorage.setItem('deau-recent', JSON.stringify(recentChannels.value))
  } catch {}
}

async function startWatching() {
  if (!channelInput.value.trim() || isLoading.value) return
  error.value = ''
  lastOpened.value = null
  isLoading.value = true

  try {
    const data = await $fetch('/api/watch', {
      method: 'POST',
      body: { channel: channelInput.value.trim() }
    })

    const waitUrl = `/wait/${data.watchId}`
    addRecent(channelInput.value.trim())
    lastOpened.value = waitUrl
    channelInput.value = ''
    
    await navigateTo(waitUrl)

  } catch (e) {
    error.value = e.data?.message || e.message || 'Connection failed'
  } finally {
    isLoading.value = false
  }
}
</script>

<style>
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
.animate-shake { animation: shake 0.4s ease-in-out; }
</style>
