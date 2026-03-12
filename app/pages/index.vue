// app/pages/index.vue
<template>
  <main class="min-h-screen text-snow flex flex-col relative bg-transparent safe-paddings">
    
    <header class="relative z-20 w-full max-w-7xl mx-auto p-4 sm:p-6 flex items-center justify-between glass-panel mt-4 rounded-2xl">
      <div class="flex items-center gap-3 sm:gap-4">
        <div class="w-8 h-8 sm:w-10 sm:h-10">
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="w-full h-full">
            <path fill="currentColor" d="M 22,15 L 65,15 C 92,15 98,35 98,50 C 98,65 92,85 58,85 L 15,85 L 23,70 L 58,70 C 78,70 82,60 82,50 C 82,40 78,30 65,30 L 30,30 Z" />
            <g transform="translate(82, 22)">
              <g stroke="#ff2d2d" stroke-width="8" stroke-linecap="round">
                <line x1="0" y1="-18" x2="0" y2="-11" /><line x1="0" y1="11" x2="0" y2="18" /><line x1="-18" y1="0" x2="-11" y2="0" /><line x1="11" y1="0" x2="18" y2="0" />
              </g>
              <circle cx="0" cy="0" r="10" fill="#ff2d2d" /><circle cx="0" cy="0" r="4" fill="white" />
            </g>
          </svg>
        </div>
        <div class="font-display text-xl sm:text-2xl tracking-widest2 text-snow uppercase">
          DEAU<span class="text-signal">WAIT</span>
        </div>
      </div>
      
      <div class="flex items-center gap-2 sm:gap-4">
        <button @click="toggleFullscreen" class="p-2 rounded-xl hover:bg-white/5 transition-colors border border-white/10 group outline-none">
          <svg v-if="!isFullscreen" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-ghost group-hover:text-snow"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-ghost group-hover:text-snow"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
        </button>
        <div class="hidden xs:block font-mono text-[10px] text-ghost tracking-widest uppercase border border-white/10 px-3 py-1.5 rounded-lg">
          v5.1.0
        </div>
      </div>
    </header>

    <div class="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">

      <div class="text-center mb-8 sm:mb-16 animate-fade-up w-full">
        <p class="font-mono text-[10px] sm:text-xs text-ghost tracking-widest3 uppercase mb-4">
          — distributed sentinel system —
        </p>
        <h1 class="font-display leading-none tracking-widest text-snow text-5xl sm:text-7xl lg:text-9xl"
          style="text-shadow: 0 0 40px rgba(255,255,255,0.05);">
          WAITING ROOM
        </h1>
      </div>

      <div class="w-full max-w-lg glass-panel p-6 sm:p-10 rounded-[2rem] animate-fade-up shadow-2xl" style="animation-delay: 0.15s; opacity: 0;">

        <div class="space-y-6">
          <div>
            <label class="block font-mono text-[10px] sm:text-xs text-ghost tracking-widest uppercase mb-3 ml-1">
              Target Channel
            </label>
            <div class="relative border border-white/10 focus-within:border-signal/50 transition-all duration-300 rounded-2xl overflow-hidden bg-black/60 backdrop-blur-md">
              <input
                v-model="channelInput"
                type="text"
                placeholder="@handle or URL..."
                class="w-full py-4 px-5 font-mono text-sm text-snow placeholder-white/20 bg-transparent outline-none"
                :disabled="isLoading"
                autocomplete="off"
                @keydown.enter="startWatching"
              />
            </div>
          </div>

          <div class="flex items-center justify-between px-1">
            <button @click="toggleRedirect" class="flex items-center gap-3 group cursor-pointer outline-none">
              <div class="w-11 h-6 rounded-full relative transition-all duration-300 border border-white/10 flex items-center px-1" 
                   :class="autoRedirect ? 'bg-signal' : 'bg-white/5'">
                <div class="w-4 h-4 rounded-full bg-snow transition-transform duration-300 shadow-sm" 
                     :class="autoRedirect ? 'translate-x-5' : 'translate-x-0'"></div>
              </div>
              <span class="font-mono text-[10px] text-ghost group-hover:text-snow uppercase tracking-widest transition-colors">
                Auto-redirect
              </span>
            </button>
          </div>

          <button
            @click="startWatching"
            :disabled="isLoading || !channelInput.trim()"
            class="w-full py-5 flex items-center justify-center font-display text-xl tracking-widest2 uppercase transition-all duration-500 rounded-2xl overflow-hidden relative group outline-none"
            :class="isLoading || !channelInput.trim()
              ? 'bg-white/5 text-ghost cursor-not-allowed'
              : 'bg-snow text-void hover:bg-signal hover:text-snow active:scale-[0.98] shadow-lg shadow-white/5'"
          >
            <span v-if="!isLoading" class="relative z-10">INITIALIZE</span>
            <span v-else class="relative z-10">
              <span class="block w-6 h-6 border-2 border-void border-t-transparent rounded-full animate-spin" />
            </span>
          </button>

          <div v-if="recentChannels.length" class="pt-4 border-t border-white/5">
            <p class="font-mono text-[9px] text-mist tracking-widest uppercase mb-3 ml-1">History</p>
            <div class="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
              <div v-for="ch in recentChannels" :key="ch"
                class="flex items-center border border-white/5 hover:border-signal/30 transition-all rounded-xl bg-white/[0.03] overflow-hidden"
              >
                <button @click="channelInput = ch" class="font-mono text-[10px] text-ghost hover:text-snow px-3 py-2 outline-none">{{ ch }}</button>
                <button @click.stop="removeRecent(ch)" class="px-2.5 py-2 text-white/10 hover:text-signal border-l border-white/5 transition-colors outline-none">✕</button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="error" class="mt-6 p-4 border border-signal/20 rounded-xl font-mono text-xs text-signal bg-signal/5 animate-shake">
          {{ error }}
        </div>

        <div v-if="lastOpened" class="mt-6 p-4 border border-white/10 rounded-xl font-mono text-[10px] text-ghost bg-white/5 flex items-center justify-between">
          <span>Watcher Active</span>
          <NuxtLink :to="lastOpened" class="text-signal hover:underline uppercase tracking-widest font-bold">Resume Monitoring →</NuxtLink>
        </div>

      </div>
    </div>

    <footer class="relative z-20 w-full max-w-7xl mx-auto m-4 rounded-2xl glass-panel p-6">
      <div class="flex flex-col md:flex-row items-center justify-between gap-6">
        <div class="flex items-center gap-6">
          <div class="flex items-center gap-3">
            <div class="w-2 h-2 rounded-full bg-signal animate-pulse shadow-[0_0_10px_rgba(255,45,45,0.5)]"></div>
            <span class="font-mono text-[10px] text-ghost tracking-widest uppercase">Distributed Engine</span>
          </div>
          <div class="hidden sm:block h-4 w-px bg-white/10"></div>
          <div class="font-mono text-[10px] text-ghost tracking-widest uppercase opacity-60 text-center sm:text-left">Production Sentinel</div>
        </div>
        
        <div class="flex items-center gap-6 font-mono text-[10px] text-mist">
          <span class="tracking-widest uppercase">wait.deau.site</span>
          <span class="text-white/10">/</span>
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
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {})
  else document.exitFullscreen().catch(() => {})
}

function addRecent(channel) {
  const filtered = recentChannels.value.filter(c => c !== channel)
  recentChannels.value = [channel, ...filtered].slice(0, 12)
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
    const data = await $fetch('/api/watch', { method: 'POST', body: { channel: channelInput.value.trim() } })
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
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
.xs\:block { display: none; }
@media (min-width: 450px) { .xs\:block { display: block; } }
</style>
