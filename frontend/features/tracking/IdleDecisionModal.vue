<script setup lang="ts">
import type { IdleDecision } from '~~/shared/utils/time'

defineProps<{
  idleSeconds: number
  error?: string
  saving?: boolean
}>()

const emit = defineEmits<{
  select: [decision: IdleDecision]
}>()

const firstAction = ref<HTMLButtonElement | null>(null)

onMounted(() => firstAction.value?.focus())
</script>

<template>
  <div class="modal-backdrop">
    <section
      class="feedback-modal idle-decision-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-decision-title"
      aria-describedby="idle-decision-description"
    >
      <header>
        <p class="eyebrow">Welcome back</p>
        <h2 id="idle-decision-title">No activity detected</h2>
        <p id="idle-decision-description">
          We noticed no keyboard or mouse activity for {{ Math.max(1, Math.round(idleSeconds / 60)) }} minutes.
          Choose how this time should affect your session.
        </p>
      </header>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="idle-decision-actions">
        <button
          ref="firstAction"
          type="button"
          class="btn primary"
          :disabled="saving"
          @click="emit('select', 'keep')"
        >
          Keep as work
        </button>
        <button
          type="button"
          class="btn ghost"
          :disabled="saving"
          @click="emit('select', 'discard')"
        >
          Exclude this time
        </button>
        <button
          type="button"
          class="btn orange"
          :disabled="saving"
          @click="emit('select', 'break')"
        >
          Save as break
        </button>
      </div>
      <p v-if="saving" class="muted" aria-live="polite">Saving your choice...</p>
    </section>
  </div>
</template>

<style scoped>
.idle-decision-modal {
  width: min(560px, calc(100vw - 32px));
}

.idle-decision-actions {
  display: grid;
  gap: 10px;
  margin-top: 20px;
}
</style>
