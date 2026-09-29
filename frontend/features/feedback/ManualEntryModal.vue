<script setup lang="ts">
import type { ApiTask } from '~/types/api'
import type { ManualEntryDraft } from './useEntries'

defineProps<{
  tasks: ApiTask[]
}>()

const emit = defineEmits<{
  close: []
  submit: []
}>()

const form = defineModel<ManualEntryDraft>('form', { required: true })
</script>

<template>
  <div class="modal-backdrop">
    <form class="task-modal" @submit.prevent="emit('submit')">
      <div class="modal-title-row">
        <h2>Manual entry</h2>
        <button type="button" class="icon-close" aria-label="Close manual entry" @click="emit('close')">x</button>
      </div>
      <p class="sub">Log time you already worked without starting the timer.</p>
      <select v-model="form.taskId" aria-label="Manual task">
        <option v-for="task in tasks" :key="task.id" :value="task.id">{{ task.title }}</option>
      </select>
      <input v-model="form.startedAt" required type="datetime-local" aria-label="Manual start">
      <input v-model="form.endedAt" required type="datetime-local" aria-label="Manual end">
      <button type="submit" class="btn primary">Add manual entry</button>
    </form>
  </div>
</template>
