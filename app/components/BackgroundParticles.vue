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
  if (typeof window === 'undefined') return
  
  const width = window.innerWidth
  const height = window.innerHeight
  const area = width * height
  const baseArea = 1920 * 1080
  
  const count = Math.min(Math.max(Math.floor(80 * (area / baseArea)), 60), 150)

  particles.value = Array.from({ length: count }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    dx: (Math.random() - 0.5) * 500,
    dy: (Math.random() - 0.5) * 500,
    size: 1.5 + Math.random() * 2.5,
    duration: 10 + Math.random() * 20,
    delay: Math.random() * -30
  }))
}

onMounted(() => {
  generateParticles()
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(generateParticles, 500)
  })
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', generateParticles)
  }
})
</script>
