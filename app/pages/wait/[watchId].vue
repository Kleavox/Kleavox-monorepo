// app/pages/wait/[watchId].vue
<template>
  <main class="min-h-screen text-snow flex flex-col relative overflow-hidden">
    
    <div class="amoled-bg">
      <div class="amoled-glow" :style="`background: radial-gradient(circle at center, ${isLive ? 'rgba(0, 255, 135, 0.04)' : 'rgba(255, 45, 45, 0.04)'} 0%, transparent 50%); transition: background 2s ease`" />
      <div class="amoled-glow-2" />
      <BackgroundParticles :count="120" />
    </div>

    <header class="relative z-10 px-6 py-6 flex items-center justify-between glass-panel border-b-0 m-4 rounded-2xl">
      <NuxtLink to="/" class="flex items-center gap-4 group">
        <div class="w-10 h-10 relative group-hover:scale-105 transition-transform duration-300">
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
      </NuxtLink>
      
      <div class="flex items-center gap-4">
        <button 
          @click="toggleFullscreen" 
          class="p-2.5 rounded-xl hover:bg-white/5 transition-colors border border-white/10 group"
          title="Toggle Fullscreen"
        >
          <svg v-if="!isFullscreen" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-ghost group-hover:text-snow"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-ghost group-hover:text-snow"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
        </button>
        <div class="font-mono text-[10px] text-ghost tracking-widest uppercase border border-white/10 px-3 py-1.5 rounded-lg">
          Room
        </div>
      </div>
    </header>

    <div class="flex-1 flex flex-col items-center justify-center px-4 py-10 text-center">

      <div class="glass-panel px-6 py-2 rounded-full mb-8 animate-fade-up">
        <p class="font-mono text-[10px] sm:text-xs text-ghost tracking-widest3 uppercase">
          {{ channelInput || 'Scanning Channel...' }}
        </p>
      </div>

      <div class="relative mb-12 animate-fade-up" style="animation-delay:0.1s;opacity:0">

        <template v-if="isLive">
          <div class="font-display leading-none text-live animate-pulse-slow"
            style="font-size: clamp(4rem, 20vw, 12rem); text-shadow: 0 0 60px rgba(0,255,135,0.15);">
            LIVE
          </div>
          <div class="mt-4 font-mono text-xs sm:text-sm text-live/80 tracking-widest uppercase bg-live/5 px-6 py-2 rounded-full inline-block border border-live/10">
            Redirecting in {{ countdown }}s...
          </div>
        </template>

        <template v-else-if="!isError">
          <div class="font-display leading-none text-snow"
            style="font-size: clamp(3.5rem, 18vw, 10rem); opacity: 0.9;">
            STANDBY
          </div>
          <div class="mt-8 flex items-center justify-center gap-3">
            <span v-for="i in 3" :key="i"
              class="inline-block w-2 h-2 rounded-full bg-signal shadow-[0_0_10px_rgba(255,45,45,0.5)]"
              :style="`animation: dotPulse 1.5s ease-in-out ${(i-1)*0.3}s infinite`" />
          </div>
          <p class="mt-6 font-mono text-[10px] text-ghost tracking-widest uppercase">
            Synchronizing with broadcast server
          </p>
        </template>

        <template v-else>
          <div class="font-display leading-none text-signal"
            style="font-size: clamp(3rem, 14vw, 8rem);">
            OFFLINE
          </div>
          <p class="mt-6 font-mono text-xs text-ghost max-w-xs mx-auto border border-white/5 p-4 rounded-2xl bg-white/5">
            Connection lost or watcher expired.<br>Maximum active duration: 12h.
          </p>
        </template>
      </div>

      <div v-if="isLive && videoTitle" class="mb-10 px-6 py-4 max-w-md glass-panel rounded-2xl animate-fade-up" style="animation-delay:0.2s;opacity:0">
        <p class="font-mono text-[10px] text-ghost uppercase tracking-widest mb-2">Transmission Detected</p>
        <p class="font-mono text-sm text-live truncate font-medium">{{ videoTitle }}</p>
      </div>

      <a
        v-if="isLive && videoUrl"
        :href="videoUrl"
        target="_blank"
        class="font-display text-2xl tracking-widest2 px-12 py-5 bg-live text-void hover:bg-snow hover:shadow-[0_0_40px_rgba(0,255,135,0.3)] transition-all animate-fade-up rounded-2xl"
        style="animation-delay:0.3s;opacity:0"
      >
        ACCESS STREAM
      </a>

      <div v-if="!isLive && !isError" class="mt-12 font-mono text-[10px] text-mist animate-fade-up space-y-2" style="animation-delay:0.4s;opacity:0">
        <p class="tracking-widest uppercase">Uptime: {{ elapsedStr }}</p>
        <p class="opacity-50">Monitoring will continue until broadcast detection</p>
      </div>

      <NuxtLink
        v-if="!isLive"
        to="/"
        class="mt-10 font-mono text-[10px] text-ghost hover:text-snow transition-all tracking-widest uppercase border-b border-ghost/20 hover:border-snow pb-1"
      >
        ← Return to Terminal
      </NuxtLink>

    </div>

    <footer class="relative z-10 m-4 rounded-2xl glass-panel p-6">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-6">
        <div class="flex items-center gap-6">
          <div class="flex items-center gap-3">
            <div :class="isLive ? 'bg-live shadow-[0_0_10px_rgba(0,255,135,0.5)]' : 'bg-signal shadow-[0_0_10px_rgba(255,45,45,0.5)]'" 
                 class="w-2 h-2 rounded-full animate-pulse"></div>
            <span class="font-mono text-[10px] text-ghost tracking-widest uppercase">
              {{ isLive ? 'Live Transmission' : 'Monitoring' }}
            </span>
          </div>
          <div class="h-4 w-px bg-white/10 hidden sm:block"></div>
          <div class="flex items-center gap-3 font-mono text-[10px] text-mist truncate max-w-[150px]">
            <span class="tracking-widest uppercase">{{ watchId }}</span>
          </div>
        </div>
        
        <div class="font-mono text-[10px] text-mist tracking-widest uppercase flex items-center gap-4">
          <span class="hover:text-snow transition-colors cursor-default">wait.deau.site</span>
          <span class="text-white/5">/</span>
          <span class="text-ghost">v4.0.0</span>
        </div>
      </div>
    </footer>

  </main>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const route = useRoute()
const watchId = route.params.watchId

const status = ref('waiting')
const videoUrl = ref(null)
const videoTitle = ref(null)
const channelInput = ref('')
const startedAt = ref(Date.now())
const isError = ref(false)
const elapsed = ref(0)
const countdown = ref(3)
const isFullscreen = ref(false)

const isLive = computed(() => status.value === 'live')

const elapsedStr = computed(() => {
  const s = elapsed.value
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}m ${rem}s`
})

useHead({
  title: computed(() =>
    isLive.value
      ? `🔴 LIVE — ${channelInput.value || 'DeauWait'}`
      : `⏳ Waiting — ${channelInput.value || 'DeauWait'}`
  )
})

let pollInterval = null
let elapsedInterval = null
let countdownInterval = null

onMounted(() => {
  poll()
  pollInterval = setInterval(poll, 30_000)
  elapsedInterval = setInterval(() => {
    elapsed.value = Math.floor((Date.now() - startedAt.value) / 1000)
  }, 1000)
  
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })
})

onUnmounted(() => {
  clearInterval(pollInterval)
  clearInterval(elapsedInterval)
  clearInterval(countdownInterval)
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

async function poll() {
  try {
    const data = await $fetch(`/api/status/${watchId}`)
    channelInput.value = data.channelInput || channelInput.value
    status.value = data.status
    videoUrl.value = data.videoUrl
    videoTitle.value = data.title

    if (data.status === 'live' && data.videoUrl) {
      clearInterval(pollInterval)
      startCountdown(data.videoUrl)
    }
  } catch {
    isError.value = true
    clearInterval(pollInterval)
  }
}

function startCountdown(url) {
  countdown.value = 3
  countdownInterval = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(countdownInterval)
      window.location.href = url
    }
  }, 1000)
}
</script>

<style>
@keyframes dotPulse {
  0%, 100% { opacity: 0.2; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}
</style>
