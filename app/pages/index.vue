// app/pages/index.vue
<template>
  <main class="min-h-screen text-snow flex flex-col relative overflow-hidden safe-paddings">
    
    <div class="amoled-bg">
      <div class="amoled-glow"></div>
      <div class="amoled-glow-2"></div>
      <BackgroundParticles />
    </div>

    <header class="relative z-10 w-full max-w-[1400px] mx-auto p-4 sm:p-6 flex items-center justify-between glass-panel mt-4 rounded-2xl landscape-hidden">
      <div class="flex items-center gap-3 sm:gap-4">
        <div class="w-8 h-8 sm:w-10 sm:h-10 relative">
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
        <div class="font-display text-xl sm:text-2xl tracking-widest2 text-snow">
          DEAU<span class="text-signal">WAIT</span>
        </div>
      </div>
      
      <div class="flex items-center gap-3 sm:gap-4">
        <button @click="toggleFullscreen" class="p-2 rounded-xl hover:bg-white/5 transition-colors border border-white/10 group">
          <svg v-if="!isFullscreen" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-ghost group-hover:text-snow"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-ghost group-hover:text-snow"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
        </button>
        <div class="hidden xs:block font-mono text-[9px] text-ghost tracking-widest uppercase border border-white/10 px-2.5 py-1 rounded-lg">
          v5.0.0
        </div>
      </div>
    </header>

    <div class="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 landscape-condensed">

      <div class="text-center mb-8 sm:mb-12 animate-fade-up w-full max-w-4xl">
        <p class="font-mono text-[9px] sm:text-xs text-ghost tracking-widest3 uppercase mb-3 sm:mb-4">
          — distributed sentinel system —
        </p>
        <h1 class="font-display leading-none tracking-widest text-snow"
          style="font-size: clamp(2.5rem, 12vw, 8rem); text-shadow: 0 0 40px rgba(255,255,255,0.05);">
          WAITING ROOM
        </h1>
      </div>

      <div class="w-full max-w-[min(100%,500px)] glass-panel p-5 sm:p-8 rounded-3xl animate-fade-up" style="animation-delay: 0.15s; opacity: 0;">

        <div class="flex flex-col gap-5 sm:gap-6">
          <div>
            <label class="block font-mono text-[9px] sm:text-xs text-ghost tracking-widest uppercase mb-3 ml-1">
              Target Channel
            </label>
            <div class="relative group">
              <div class="absolute -inset-0.5 bg-gradient-to-r from-signal/20 to-signal/5 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
              <div class="relative border border-white/10 focus-within:border-signal/50 transition-all duration-300 rounded-2xl overflow-hidden bg-black/40 backdrop-blur-md">
                <input
                  v-model="channelInput"
                  type="text"
                  placeholder="@handle, URL, or channel ID..."
                  class="w-full py-3.5 sm:py-4.5 px-4 sm:px-5 font-mono text-sm text-snow placeholder-white/20 bg-transparent"
                  :disabled="isLoading"
                  autocomplete="off"
                  @keydown.enter="startWatching"
                />
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-4">
            <button @click="toggleRedirect" class="flex items-center gap-3 group cursor-pointer w-fit ml-1">
              <div class="w-8 h-4.5 rounded-full relative transition-all duration-300 border border-white/10" 
                   :class="autoRedirect ? 'bg-signal border-signal/50' : 'bg-white/5'">
                <div class="absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full bg-snow transition-transform duration-300" 
                     :class="autoRedirect ? 'translate-x-3.5' : 'translate-x-0'"></div>
              </div>
              <span class="font-mono text-[9px] text-ghost group-hover:text-snow uppercase tracking-widest transition-colors">
                Auto-redirect
              </span>
            </button>

            <button
              @click="startWatching"
              :disabled="isLoading || !channelInput.trim()"
              class="w-full py-4 sm:py-5 font-display text-lg sm:text-xl tracking-widest2 uppercase transition-all duration-500 rounded-2xl overflow-hidden relative group"
              :class="isLoading || !channelInput.trim()
                ? 'bg-white/5 text-ghost cursor-not-allowed'
                : 'bg-snow text-void hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-[0.98]'"
            >
              <span v-if="!isLoading" class="relative z-10">INITIALIZE</span>
              <span v-else class="flex items-center justify-center gap-3 relative z-10">
                <span class="inline-block w-4 h-4 border-2 border-void border-t-transparent rounded-full animate-spin" />
                ...
              </span>
              <div v-if="!isLoading && channelInput.trim()" class="absolute inset-0 bg-signal translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
            </button>
          </div>

          <div v-if="recentChannels.length" class="landscape-hidden">
            <p class="font-mono text-[8px] text-mist tracking-widest uppercase mb-2.5 ml-1">Recently Watched</p>
            <div class="flex flex-wrap gap-1.5 sm:gap-2 max-h-[120px] overflow-y-auto pr-2 custom-scrollbar">
              <div
                v-for="ch in recentChannels"
                :key="ch"
                class="flex items-center border border-white/5 hover:border-signal/30 transition-all group rounded-xl overflow-hidden bg-white/[0.02]"
              >
                <button @click="channelInput = ch" class="font-mono text-[9px] text-ghost group-hover:text-snow px-2.5 py-1.5">{{ ch }}</button>
                <button @click.stop="removeRecent(ch)" class="font-mono text-[9px] text-white/10 hover:text-signal px-2 py-1.5 border-l border-white/5">✕</button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="error" class="mt-4 p-3 border border-signal/20 rounded-xl font-mono text-[10px] text-signal bg-signal/5 animate-shake">
          {{ error }}
        </div>

        <div v-if="lastOpened" class="mt-4 p-3 border border-white/10 rounded-xl font-mono text-[10px] text-ghost bg-white/5 flex items-center justify-between">
          <span>Active Session</span>
          <NuxtLink :to="lastOpened" class="text-signal hover:underline uppercase tracking-widest">Resume →</NuxtLink>
        </div>

      </div>
    </div>

    <footer class="relative z-10 w-full max-w-[1400px] mx-auto m-4 rounded-2xl glass-panel p-4 sm:p-6 landscape-hidden">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
        <div class="flex items-center gap-4 sm:gap-6">
          <div class="flex items-center gap-2">
            <div class="w-1.5 h-1.5 rounded-full bg-signal animate-pulse shadow-[0_0_8px_rgba(255,45,45,0.5)]"></div>
            <span class="font-mono text-[9px] text-ghost tracking-widest uppercase">Sentinel V5</span>
          </div>
          <div class="h-3 w-px bg-white/10 hidden sm:block"></div>
          <div class="font-mono text-[9px] text-ghost tracking-widest uppercase">Distributed Sync</div>
        </div>
        
        <div class="flex items-center gap-4 sm:gap-6 font-mono text-[9px] text-mist">
          <span class="tracking-widest uppercase">wait.deau.site</span>
          <span class="text-white/5">/</span>
          <span class="tracking-widest uppercase">© {{ new Date().getFullYear() }}</span>
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
const autoRedirect = ref(false)

onMounted(() => {
  try {
    const saved = localStorage.getItem('deau-recent')
    if (saved) recentChannels.value = JSON.parse(saved)
    autoRedirect.value = localStorage.getItem('deau-redirect') === 'true'
  } catch {}
  document.addEventListener('fullscreenchange', () => isFullscreen.value = !!document.fullscreenElement)
})

function toggleRedirect() {
  autoRedirect.value = !autoRedirect.value
  try { localStorage.setItem('deau-redirect', autoRedirect.value.toString()) } catch {}
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

function addRecent(channel) {
  const filtered = recentChannels.value.filter(c => c !== channel)
  recentChannels.value = [channel, ...filtered].slice(0, 10)
  try { localStorage.setItem('deau-recent', JSON.stringify(recentChannels.value)) } catch {}
}

function removeRecent(channel) {
  recentChannels.value = recentChannels.value.filter(c => c !== channel)
  try { localStorage.setItem('deau-recent', JSON.stringify(recentChannels.value)) } catch {}
}

async function startWatching() {
  if (!channelInput.value.trim() || isLoading.value) return
  error.value = ''
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
    error.value = e.data?.message || e.message || 'Initialization failed'
  } finally {
    isLoading.value = false
  }
}
</script>

<style>
@keyframes shake { 0%, 100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
.animate-shake { animation: shake 0.4s ease-in-out; }
.xs\:block { display: none; }
@media (min-width: 400px) { .xs\:block { display: block; } }
.custom-scrollbar::-webkit-scrollbar { width: 3px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
</style>
