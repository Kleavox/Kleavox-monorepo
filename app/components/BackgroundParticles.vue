<template>
  <ClientOnly>
    <div class="particle-container">
      <div 
        v-for="p in particles" 
        :key="p.id" 
        class="particle"
        :style="{
          left: p.x + '%',
          top: p.y + '%',
          '--x': p.dx + 'px',
          '--y': p.dy + 'px',
          width: p.size + 'px',
          height: p.size + 'px',
          animation: `float-particle ${p.duration}s ease-in-out ${p.delay}s infinite`
        }"
      ></div>
    </div>
  </ClientOnly>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const particles = ref([])
let resizeTimer = null

const generateParticles = () => {
  const area = window.innerWidth * window.innerHeight
  const baseArea = 1920 * 1080
  const count = Math.min(Math.max(Math.floor(60 * (area / baseArea)), 40), 150)

  particles.value = Array.from({ length: count }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    dx: (Math.random() - 0.5) * 400,
    dy: (Math.random() - 0.5) * 400,
    size: 1 + Math.random() * 2,
    duration: 15 + Math.random() * 25,
    delay: Math.random() * -30
  }))
}

const handleResize = () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(generateParticles, 500)
}

onMounted(() => {
  generateParticles()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  clearTimeout(resizeTimer)
})
</script>
