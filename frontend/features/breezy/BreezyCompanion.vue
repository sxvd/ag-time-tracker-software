<script setup lang="ts">
import type { BreezyPresentation } from './breezyRuntime'
import { mascotPools } from './mascotCatalog'
import { withAppBase } from '~~/shared/utils/url'

const props = withDefaults(defineProps<{ presentation: BreezyPresentation, motionKey?: number, muted: boolean }>(), {
  motionKey: 0
})

const mascotRotationMs = 2 * 60 * 1000
const currentMascot = ref('')
const currentMascotUrl = computed(() => withAppBase(useRuntimeConfig().app.baseURL, currentMascot.value))
let mascotTimer: ReturnType<typeof setInterval> | null = null
let mounted = false

function pickMascot(pool: readonly string[], excluding?: string) {
  const candidates = pool.length > 1 && excluding
    ? pool.filter(image => image !== excluding)
    : pool
  return candidates[Math.floor(Math.random() * candidates.length)]!
}

function selectFromCurrentPool(excluding?: string) {
  currentMascot.value = pickMascot(mascotPools[props.presentation.imagePool], excluding)
}

function stopMascotTimer() {
  if (mascotTimer) clearInterval(mascotTimer)
  mascotTimer = null
}

function syncMascotTimer() {
  stopMascotTimer()
  if (!mounted || props.muted) return
  mascotTimer = setInterval(() => {
    selectFromCurrentPool(currentMascot.value)
  }, mascotRotationMs)
}

watch(() => props.presentation.imagePool, () => selectFromCurrentPool(currentMascot.value), { immediate: true })

onMounted(() => {
  mounted = true
  syncMascotTimer()
})

watch(() => props.muted, syncMascotTimer)

onBeforeUnmount(() => {
  mounted = false
  stopMascotTimer()
})
</script>

<template>
  <section class="breezy-panel" :class="{ 'is-muted': muted }" :aria-live="presentation.announce ? 'polite' : 'off'">
    <div :key="motionKey" class="breezy-orbit" :class="{ wiggle: presentation.celebrate }" :data-mood="presentation.mood">
      <div class="breezy-photo" role="img" :aria-label="presentation.label">
        <img :src="currentMascotUrl" alt="">
      </div>
    </div>
    <div class="breezy-copy">
      <p class="eyebrow">Breezy</p>
      <h2>{{ presentation.label }}</h2>
      <p v-if="presentation.message" class="breezy-message">{{ presentation.message }}</p>
    </div>
  </section>
</template>
