// app/pages/wait/[watchId].vue
<template>
  <main class="min-h-screen text-snow flex flex-col relative overflow-hidden">
    
    <div class="amoled-bg">
      <div class="amoled-glow" :style="`background: radial-gradient(circle at center, ${isLive ? 'rgba(0, 255, 135, 0.04)' : 'rgba(255, 45, 45, 0.04)'} 0%, transparent 50%); transition: background 2s ease`" />
      <div class="amoled-glow-2" />
      <BackgroundParticles :count="120" />
    </div>

    <header v-if="!isTheater && !isIntro" class="relative z-10 px-6 py-6 flex items-center justify-between glass-panel border-b-0 m-4 rounded-2xl animate-fade-down">
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
      </div>
    </header>

    <div class="flex-1 flex flex-col items-center justify-center relative z-10 px-4">
      
      <div v-if="isIntro" class="flex flex-col items-center animate-intro-zoom">
        <div class="w-24 h-24 bg-live rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(0,255,135,0.4)] animate-live-pulse mb-8">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
        <h2 class="font-display text-6xl sm:text-8xl tracking-widest text-live mb-4">LIVE NOW</h2>
        <p class="font-mono text-xs text-live/60 tracking-widest uppercase animate-pulse">
          {{ autoRedirect ? 'Forwarding to YouTube...' : 'Establishing connection...' }}
        </p>
      </div>

      <div v-show="isLive && !isIntro" class="w-full max-w-5xl aspect-video relative transition-all duration-1000 transform" 
           :class="isTheater ? 'fixed inset-0 max-w-none h-full z-50 bg-black' : 'rounded-3xl overflow-hidden glass-panel shadow-2xl animate-fade-up'">
        
        <iframe 
          v-if="videoId"
          :src="`https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0&origin=${origin}`"
          class="w-full h-full"
          frameborder="0"
          allow="autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
        ></iframe>
        
        <div class="absolute top-4 right-4 flex gap-2">
          <button @click="isTheater = !isTheater" 
                  class="bg-black/60 hover:bg-black/80 p-2 rounded-lg border border-white/10 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/></svg>
          </button>
        </div>
      </div>

      <div v-if="!isLive && !isIntro" class="flex flex-col items-center">
        <div class="glass-panel px-6 py-2 rounded-full mb-8 animate-fade-up">
          <p class="font-mono text-[10px] sm:text-xs text-ghost tracking-widest3 uppercase">
            {{ channelInput || 'Scanning Channel...' }}
          </p>
        </div>

        <div class="relative mb-12 animate-fade-up" style="animation-delay:0.1s;opacity:0">
          <template v-if="!isError">
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
              Distributed detection active
            </p>
          </template>

          <template v-else>
            <div class="font-display leading-none text-signal"
              style="font-size: clamp(3rem, 14vw, 8rem);">
              OFFLINE
            </div>
            <p class="mt-6 font-mono text-xs text-ghost max-w-xs mx-auto border border-white/5 p-4 rounded-2xl bg-white/5">
              Connection lost or watcher expired.
            </p>
          </template>
        </div>

        <div class="mt-12 font-mono text-[10px] text-mist animate-fade-up space-y-2" style="animation-delay:0.4s;opacity:0">
          <p class="tracking-widest uppercase">Uptime: {{ elapsedStr }}</p>
          <p class="opacity-50">Browser sentinel active — Monitoring status</p>
        </div>

        <NuxtLink
          to="/"
          class="mt-10 font-mono text-[10px] text-ghost hover:text-snow transition-all tracking-widest uppercase border-b border-ghost/20 hover:border-snow pb-1"
        >
          ← Return to Terminal
        </NuxtLink>
      </div>

    </div>

    <div id="detector-player" class="pointer-events-none opacity-0 absolute -top-[9999px]"></div>

    <footer v-if="!isTheater && !isIntro" class="relative z-10 m-4 rounded-2xl glass-panel p-6 animate-fade-up">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-6">
        <div class="flex items-center gap-6">
          <div class="flex items-center gap-3">
            <div :class="isLive ? 'bg-live shadow-[0_0_10px_rgba(0,255,135,0.5)]' : 'bg-signal shadow-[0_0_10px_rgba(255,45,45,0.5)]'" 
                 class="w-2 h-2 rounded-full animate-pulse"></div>
            <span class="font-mono text-[10px] text-ghost tracking-widest uppercase">
              {{ isLive ? 'Live Stream Active' : 'Sentinel Mode' }}
            </span>
          </div>
          <div class="h-4 w-px bg-white/10 hidden sm:block"></div>
          
          <button v-if="!isLive" @click="toggleRedirect" class="flex items-center gap-2 group cursor-pointer">
            <div class="w-7 h-4 rounded-full relative transition-all duration-300 border border-white/10" 
                 :class="autoRedirect ? 'bg-signal' : 'bg-white/5'">
              <div class="absolute top-0.5 left-0.5 w-2 h-2 rounded-full bg-snow transition-transform duration-300" 
                   :class="autoRedirect ? 'translate-x-3' : 'translate-x-0'"></div>
            </div>
            <span class="font-mono text-[9px] text-ghost group-hover:text-snow uppercase tracking-widest transition-colors">
              Redirect: {{ autoRedirect ? 'ON' : 'OFF' }}
            </span>
          </button>

          <a v-else :href="videoUrl" target="_blank" class="flex items-center gap-2 group cursor-pointer">
            <span class="font-mono text-[10px] text-live group-hover:text-snow uppercase tracking-widest transition-colors flex items-center gap-2">
              Open in YouTube
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="4"/></svg>
            </span>
          </a>
        </div>
        
        <div class="font-mono text-[10px] text-mist tracking-widest uppercase flex items-center gap-4">
          <span class="text-ghost">v4.2.0</span>
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
const channelId = ref('')
const channelInput = ref('')
const startedAt = ref(Date.now())
const isError = ref(false)
const elapsed = ref(0)
const isFullscreen = ref(false)
const isTheater = ref(false)
const isIntro = ref(false)
const autoRedirect = ref(false)
const videoUrl = ref('')
const origin = ref('')

let detectorPlayer = null
let pollInterval = null
let elapsedInterval = null

const isLive = computed(() => status.value === 'live')

const videoId = computed(() => {
  if (!videoUrl.value) return ''
  const match = videoUrl.value.match(/v=([a-zA-Z0-9_-]{11})/) || videoUrl.value.match(/embed\/([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : ''
})

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

onMounted(() => {
  origin.value = window.location.origin
  initStatus()
  elapsedInterval = setInterval(() => {
    elapsed.value = Math.floor((Date.now() - startedAt.value) / 1000)
  }, 1000)
  
  try {
    autoRedirect.value = localStorage.getItem('deau-redirect') === 'true'
  } catch {}

  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })

  // Global callback for YT API
  window.onYouTubeIframeAPIReady = () => {
    if (status.value === 'waiting') initDetector()
  }

  // Load YouTube API script
  if (!window.YT) {
    const tag = document.createElement('script')
    tag.src = "https://www.youtube.com/iframe_api"
    const firstScriptTag = document.getElementsByTagName('script')[0]
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
  } else if (window.YT.Player) {
    window.onYouTubeIframeAPIReady()
  }
})

onUnmounted(() => {
  clearInterval(pollInterval)
  clearInterval(elapsedInterval)
  if (detectorPlayer) detectorPlayer.destroy()
})

function toggleRedirect() {
  autoRedirect.value = !autoRedirect.value
  try {
    localStorage.setItem('deau-redirect', autoRedirect.value.toString())
  } catch {}
}

async function initStatus() {
  try {
    const data = await $fetch(`/api/status/${watchId}`)
    channelId.value = data.channelId
    channelInput.value = data.channelInput
    status.value = data.status
    videoUrl.value = data.videoUrl || ''
    
    if (status.value === 'live') {
      triggerLive(data.videoUrl)
    } else {
      pollInterval = setInterval(pollServer, 60_000)
    }
  } catch {
    isError.value = true
  }
}

async function pollServer() {
  try {
    const data = await $fetch(`/api/status/${watchId}`)
    if (data.status === 'live' && status.value !== 'live') {
      videoUrl.value = data.videoUrl || ''
      triggerLive(data.videoUrl)
      clearInterval(pollInterval)
    }
  } catch {}
}

function initDetector() {
  if (!window.YT || !window.YT.Player || detectorPlayer || !channelId.value) return

  detectorPlayer = new window.YT.Player('detector-player', {
    height: '1',
    width: '1',
    playerVars: {
      'autoplay': 1,
      'mute': 1,
      'listType': 'live_stream',
      'list': channelId.value,
      'origin': window.location.origin
    },
    events: {
      'onStateChange': (event) => {
        if (event.data === window.YT.PlayerState.PLAYING || event.data === window.YT.PlayerState.BUFFERING) {
          const currentVideoUrl = detectorPlayer.getVideoUrl()
          const vid = currentVideoUrl.match(/v=([a-zA-Z0-9_-]{11})/)?.[1]
          if (vid) {
            videoUrl.value = `https://www.youtube.com/watch?v=${vid}`
            reportLive(vid)
          }
        }
      }
    }
  })
}

async function reportLive(vid) {
  try {
    const res = await $fetch('/api/report-live', {
      method: 'POST',
      body: { watchId, videoId: vid }
    })
    if (res.success && status.value !== 'live') {
      triggerLive(`https://www.youtube.com/watch?v=${vid}`)
      clearInterval(pollInterval)
    }
  } catch {}
}

function triggerLive(url) {
  status.value = 'live'
  isIntro.value = true
  
  setTimeout(() => {
    if (autoRedirect.value) {
      window.location.href = url
    } else {
      isIntro.value = false
    }
  }, 3500)
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}
</script>

<style>
@keyframes dotPulse {
  0%, 100% { opacity: 0.2; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}
.animate-fade-down { animation: fadeDown 0.6s ease-out forwards; }
@keyframes fadeDown {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes introZoom {
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.animate-intro-zoom { animation: introZoom 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
@keyframes livePulseGlow {
  0% { transform: scale(1); box-shadow: 0 0 20px rgba(0,255,135,0.4); }
  50% { transform: scale(1.1); box-shadow: 0 0 60px rgba(0,255,135,0.6); }
  100% { transform: scale(1); box-shadow: 0 0 20px rgba(0,255,135,0.4); }
}
.animate-live-pulse { animation: livePulseGlow 2s infinite ease-in-out; }
</style>
