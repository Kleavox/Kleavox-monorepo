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
import { ref, onMounted } from 'vue'

const props = defineProps({
  count: { type: Number, default: 60 }
})

const particles = ref([])

onMounted(() => {
  particles.value = Array.from({ length: props.count }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    dx: (Math.random() - 0.5) * 400,
    dy: (Math.random() - 0.5) * 400,
    size: 1 + Math.random() * 2,
    duration: 15 + Math.random() * 25,
    delay: Math.random() * -30
  }))
})
</script>
