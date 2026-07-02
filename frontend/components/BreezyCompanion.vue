<script setup lang="ts">
const props = withDefaults(defineProps<{ mood: string, muted: boolean, message: string, featured?: boolean, motionKey?: number }>(), {
  featured: false
})
const moodLabel = computed(() => props.muted ? 'quiet' : props.mood)
</script>

<template>
  <section class="breezy-panel" :class="{ featured }" aria-live="polite">
    <div :key="motionKey" class="breezy-orbit" :class="{ wiggle: motionKey }" :data-mood="mood">
      <div class="breezy-photo" role="img" :aria-label="`Breezy is ${moodLabel}`">
        <img src="/breezy-main.png" alt="">
      </div>
    </div>
    <div>
      <p class="eyebrow">Breezy: {{ moodLabel }}</p>
      <p class="breezy-message">{{ muted ? 'Breezy is muted.' : message }}</p>
    </div>
  </section>
</template>
