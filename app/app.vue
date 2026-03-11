// app/app.vue
<template>
  <div id="app-wrapper" class="min-h-screen bg-transparent selection:bg-signal/30">
    <div class="amoled-bg">
      <div class="amoled-glow"></div>
      <div class="amoled-glow-2"></div>
      <BackgroundParticles />
    </div>
    
    <div class="relative z-10 min-h-screen flex flex-col bg-transparent">
      <NuxtPage />
    </div>
  </div>
</template>

<script setup>
useHead({
  htmlAttrs: { lang: 'id', class: 'bg-black' }, // Body/Html base black for safety
  bodyAttrs: { class: 'bg-transparent' }
})
</script>
