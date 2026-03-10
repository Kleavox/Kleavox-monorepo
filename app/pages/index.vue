// app/pages/index.vue
<template>
  <main class="min-h-screen bg-void text-snow flex flex-col">

    <div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[600px] h-[200px] sm:h-[300px] opacity-10 pointer-events-none"
      style="background: radial-gradient(ellipse at center top, #ff2d2d 0%, transparent 70%);" />

    <header class="relative z-10 px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between border-b border-smoke">
      <div class="font-display text-xl sm:text-2xl tracking-widest2 text-snow">
        DEAU<span class="text-signal">WAIT</span>
      </div>
      <div class="font-mono text-[10px] sm:text-xs text-ghost tracking-widest uppercase">
        YT Live Watcher
      </div>
    </header>

    <div class="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-10 sm:py-20">

      <div class="text-center mb-8 sm:mb-16 animate-fade-up w-full">
        <p class="font-mono text-[10px] sm:text-xs text-ghost tracking-widest3 uppercase mb-3 sm:mb-4">
          — wait until they go live —
        </p>
        <h1 class="font-display leading-none tracking-widest text-snow"
          style="font-size: clamp(3rem, 16vw, 10rem);">
          STANDBY
        </h1>
        <div class="mt-3 h-px w-32 sm:w-48 mx-auto bg-gradient-to-r from-transparent via-signal to-transparent" />
      </div>

      <div class="w-full max-w-lg animate-fade-up" style="animation-delay: 0.15s; opacity: 0;">

        <label class="block font-mono text-[10px] sm:text-xs text-ghost tracking-widest uppercase mb-2 sm:mb-3">
          YouTube Channel
        </label>

        <div class="relative border border-smoke focus-within:border-signal transition-colors duration-300"
          style="background: rgba(26,26,26,0.8);">
          <input
            v-model="channelInput"
            type="text"
            placeholder="@handle, URL, or channel ID..."
            class="w-full py-3.5 sm:py-4 px-4 font-mono text-sm text-snow placeholder-mist bg-transparent"
            :disabled="isLoading"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            @keydown.enter="startWatching"
          />
        </div>

        <div v-if="recentChannels.length" class="mt-3">
          <p class="font-mono text-[9px] text-mist tracking-widest uppercase mb-1.5">Recent</p>
          <div class="flex flex-wrap gap-1.5">
            <div
              v-for="ch in recentChannels"
              :key="ch"
              class="flex items-center gap-0 border border-smoke hover:border-signal transition-colors group"
              style="background: rgba(26,26,26,0.6);"
            >
              <button
                @click="channelInput = ch"
                class="font-mono text-[10px] text-ghost group-hover:text-signal transition-colors px-2 py-1"
              >
                {{ ch }}
              </button>
              <button
                @click.stop="removeRecent(ch)"
                class="font-mono text-[10px] text-mist hover:text-signal transition-colors px-1.5 py-1 border-l border-smoke hover:border-signal"
                title="Remove"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        <button
          @click="startWatching"
          :disabled="isLoading || !channelInput.trim()"
          class="mt-4 sm:mt-5 w-full py-3.5 sm:py-4 font-display text-lg sm:text-xl tracking-widest2 uppercase transition-all duration-300"
          :class="isLoading || !channelInput.trim()
            ? 'bg-smoke text-ghost cursor-not-allowed'
            : 'bg-signal text-void hover:bg-snow cursor-pointer active:scale-[0.98]'"
        >
          <span v-if="!isLoading">START WAITING</span>
          <span v-else class="flex items-center justify-center gap-3">
            <span class="inline-block w-4 h-4 border-2 border-void border-t-transparent rounded-full animate-spin" />
            CONNECTING...
          </span>
        </button>

        <div v-if="error" class="mt-3 p-3 sm:p-4 border border-signal-dim font-mono text-xs text-signal leading-relaxed"
          style="background: rgba(255,45,45,0.08);">
          <span class="font-bold">⚠ ERROR</span><br>
          {{ error }}
        </div>

        <div v-if="lastOpened" class="mt-3 p-3 border border-smoke font-mono text-xs text-ghost"
          style="background: rgba(26,26,26,0.8);">
          Waiting room opened.
          <a :href="lastOpened" target="_blank" class="text-signal hover:underline ml-1">Open again →</a>
        </div>

      </div>
    </div>

    <footer class="relative z-10 border-t border-smoke">
      <div class="h-px w-full bg-gradient-to-r from-transparent via-signal to-transparent opacity-20" />
      <div class="px-4 sm:px-8 py-4 sm:py-5 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
        <div class="flex items-center gap-3">
          <span class="font-display text-sm tracking-widest text-snow">DEAU<span class="text-signal">WAIT</span></span>
          <span class="font-mono text-[10px] text-ghost border border-smoke px-1.5 py-0.5">v2</span>
        </div>
        <div class="flex items-center gap-1.5 font-mono text-[10px] text-ghost">
          <span class="waiting-dot" style="width:6px;height:6px" />
          <span class="tracking-widest uppercase">poll · 2 min</span>
        </div>
        <div class="flex items-center gap-3 font-mono text-[10px] text-mist">
          <span class="tracking-widest uppercase">wait.deau.site</span>
          <span class="text-smoke">·</span>
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

const MAX_RECENT = 6

onMounted(() => {
  try {
    const saved = localStorage.getItem('deau-recent')
    if (saved) recentChannels.value = JSON.parse(saved)
  } catch {}
})

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
    window.open(waitUrl, '_blank')

  } catch (e) {
    error.value = e.data?.message || e.message || 'Failed to start'
  } finally {
    isLoading.value = false
  }
}
</script>
