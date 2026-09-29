<script setup lang="ts">
import type { ApiBreezyNudge } from '~/types/api'

const props = withDefaults(defineProps<{
  nudge: ApiBreezyNudge
  restored?: boolean
  dismissing?: boolean
  error?: string
}>(), {
  restored: false,
  dismissing: false,
  error: ''
})

defineEmits<{ dismiss: [] }>()

const label = computed(() => {
  switch (props.nudge.type) {
    case 'hydration': return 'Hydration reminder'
    case 'ventilation': return 'Fresh-air reminder'
    default: return 'Focus reminder'
  }
})
</script>

<template>
  <aside class="breezy-toast" role="status" :aria-live="restored ? 'off' : 'polite'">
    <div>
      <strong>{{ label }}</strong>
      <p>{{ nudge.message }}</p>
      <p v-if="error" class="breezy-toast-error" role="alert">{{ error }}</p>
    </div>
    <button type="button" aria-label="Dismiss Breezy reminder" :disabled="dismissing" @click="$emit('dismiss')">×</button>
  </aside>
</template>
