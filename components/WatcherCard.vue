<template>
  <div
    class="relative border transition-all duration-500 p-3 sm:p-4 flex items-center justify-between gap-2 sm:gap-4"
    :class="watcher.status === 'live'
      ? 'border-live bg-live-glow'
      : 'border-smoke bg-ash hover:border-mist'"
  >
    <!-- Status dot + info -->
    <div class="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
      <span :class="watcher.status === 'live' ? 'live-dot shrink-0' : 'waiting-dot shrink-0'" />
      <div class="min-w-0">
        <p class="font-mono text-[10px] sm:text-xs text-ghost uppercase tracking-widest truncate">
          {{ watcher.channelInput }}
        </p>
        <p class="font-mono text-[10px] sm:text-xs mt-0.5"
          :class="watcher.status === 'live' ? 'text-live' : 'text-signal'">
          {{ watcher.status === 'live' ? '● LIVE — redirect sebentar...' : '○ menunggu...' }}
        </p>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
      <a
        v-if="watcher.status === 'live' && watcher.videoUrl"
        :href="watcher.videoUrl"
        target="_blank"
        class="font-display text-xs sm:text-sm tracking-widest px-2 sm:px-3 py-1.5 bg-live text-void hover:bg-snow transition-colors whitespace-nowrap"
      >
        TONTON
      </a>
      <button
        @click="$emit('remove', watcher.watchId)"
        class="font-mono text-xs text-ghost hover:text-signal transition-colors px-2 py-1.5 touch-target"
        title="Hapus"
      >
        ✕
      </button>
    </div>

    <!-- Live shimmer -->
    <div
      v-if="watcher.status === 'live'"
      class="absolute inset-0 pointer-events-none"
      style="background: linear-gradient(90deg, transparent 0%, rgba(0,255,135,0.03) 50%, transparent 100%);
             animation: shimmer 2s ease-in-out infinite;"
    />
  </div>
</template>

<script setup>
defineProps({ watcher: Object })
defineEmits(['remove'])
</script>

<style scoped>
@keyframes shimmer {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
/* Larger tap target on mobile */
.touch-target {
  min-width: 36px;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
