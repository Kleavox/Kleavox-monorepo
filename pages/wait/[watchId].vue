<template>
  <main class="min-h-screen bg-void text-snow flex flex-col">

    <div class="fixed inset-0 pointer-events-none overflow-hidden">
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[400px] opacity-10"
        :style="`background: radial-gradient(ellipse at center top, ${isLive ? '#00ff87' : '#ff2d2d'} 0%, transparent 70%); transition: background 1.5s ease`" />
    </div>

    <header class="relative z-10 px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between border-b border-smoke">
      <NuxtLink to="/" class="font-display text-xl sm:text-2xl tracking-widest2 text-snow hover:text-signal transition-colors">
        DEAU<span class="text-signal">WAIT</span>
      </NuxtLink>
      <div class="font-mono text-[10px] sm:text-xs text-ghost tracking-widest uppercase">
        waiting room
      </div>
    </header>

    <div class="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:py-20 text-center">

      <p class="font-mono text-[10px] sm:text-xs text-ghost tracking-widest3 uppercase mb-4 sm:mb-6 animate-fade-up">
        {{ channelInput || '...' }}
      </p>

      <div class="relative mb-8 sm:mb-12 animate-fade-up" style="animation-delay:0.1s;opacity:0">

        <template v-if="isLive">
          <div class="font-display leading-none text-live"
            style="font-size: clamp(3.5rem, 18vw, 11rem);">
            LIVE
          </div>
          <div class="mt-2 font-mono text-xs sm:text-sm text-live opacity-80">
            redirecting in {{ countdown }}s...
          </div>
        </template>

        <template v-else-if="!isError">
          <div class="font-display leading-none text-snow"
            style="font-size: clamp(3rem, 16vw, 10rem);">
            STANDBY
          </div>
          <div class="mt-4 flex items-center justify-center gap-2">
            <span v-for="i in 3" :key="i"
              class="inline-block w-1.5 h-1.5 rounded-full bg-signal"
              :style="`animation: dotPulse 1.5s ease-in-out ${(i-1)*0.3}s infinite`" />
          </div>
          <p class="mt-3 font-mono text-xs text-ghost">
            checking every 2 minutes
          </p>
        </template>

        <template v-else>
          <div class="font-display leading-none text-signal"
            style="font-size: clamp(2.5rem, 12vw, 7rem);">
            ERROR
          </div>
          <p class="mt-4 font-mono text-xs text-ghost max-w-xs mx-auto">
            Watcher not found.<br>It may have expired (12h limit).
          </p>
        </template>
      </div>

      <div v-if="isLive && videoTitle" class="mb-6 px-4 max-w-md animate-fade-up" style="animation-delay:0.2s;opacity:0">
        <p class="font-mono text-xs text-ghost uppercase tracking-widest mb-1">Now streaming</p>
        <p class="font-mono text-sm text-live truncate">{{ videoTitle }}</p>
      </div>

      <a
        v-if="isLive && videoUrl"
        :href="videoUrl"
        target="_blank"
        class="font-display text-xl sm:text-2xl tracking-widest2 px-8 sm:px-12 py-4 bg-live text-void hover:bg-snow transition-colors animate-fade-up"
        style="animation-delay:0.3s;opacity:0"
      >
        WATCH NOW
      </a>

      <div v-if="!isLive && !isError" class="mt-8 sm:mt-12 font-mono text-xs text-mist animate-fade-up" style="animation-delay:0.4s;opacity:0">
        <p>waiting for {{ elapsedStr }}</p>
        <p class="mt-1">this tab will auto-redirect when a live stream is detected</p>
      </div>

      <NuxtLink
        v-if="!isLive"
        to="/"
        class="mt-6 font-mono text-xs text-ghost hover:text-snow transition-colors underline underline-offset-4"
      >
        ← watch another channel
      </NuxtLink>

    </div>

    <footer class="relative z-10 border-t border-smoke">
      <div class="h-px w-full bg-gradient-to-r from-transparent via-signal to-transparent opacity-20" />
      <div class="px-4 sm:px-8 py-4 sm:py-5 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
        <!-- Brand -->
        <div class="flex items-center gap-3">
          <NuxtLink to="/" class="font-display text-sm tracking-widest text-snow hover:text-signal transition-colors">DEAU<span class="text-signal">WAIT</span></NuxtLink>
          <span class="font-mono text-[10px] text-ghost border border-smoke px-1.5 py-0.5">v2</span>
        </div>
        <!-- Status -->
        <div class="flex items-center gap-2 font-mono text-[10px]"
          :class="isLive ? 'text-live' : 'text-ghost'">
          <span :class="isLive ? 'live-dot' : 'waiting-dot'" style="width:6px;height:6px" />
          <span class="tracking-widest uppercase">{{ isLive ? 'live' : 'waiting' }}</span>
          <span class="text-smoke">·</span>
          <span class="text-mist font-mono truncate max-w-[120px]">{{ watchId }}</span>
        </div>
        <!-- Right -->
        <div class="font-mono text-[10px] text-mist tracking-widest uppercase">
          wait.deau.site
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
})

onUnmounted(() => {
  clearInterval(pollInterval)
  clearInterval(elapsedInterval)
  clearInterval(countdownInterval)
})

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
