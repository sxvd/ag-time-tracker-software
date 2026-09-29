<script setup lang="ts">
import type { ApiCategory, ApiInvitation, ApiTask } from '~/types/api'

defineProps<{
  categories: ApiCategory[]
  inlineCategoryId: string
  shareableTask: ApiTask | null
  sharedTasks: Array<{ invitation: ApiInvitation, task: ApiTask }>
  userName: (userId: string) => string
}>()

const emit = defineEmits<{
  acceptInvitation: [invitationId: string]
  draftChange: []
  openShare: []
  selectCategory: [categoryId: string]
}>()

const title = defineModel<string>('title', { required: true })
const taskInput = ref<HTMLInputElement | null>(null)

function focusTaskInput() {
  taskInput.value?.focus()
}

defineExpose({ focusTaskInput })
</script>

<template>
  <div class="task-composer">
    <label>
      <input
        ref="taskInput"
        v-model="title"
        aria-label="Task name"
        placeholder="What are you working on?"
        @input="emit('draftChange')"
      >
    </label>
    <div class="category-tags" aria-label="Choose category">
      <button
        v-for="(category, index) in categories"
        :key="category.id"
        type="button"
        class="chip"
        :class="{ sel: inlineCategoryId === category.id }"
        @click="emit('selectCategory', category.id)"
      >
        <i :class="`tag-dot tag-${index + 1}`"></i>{{ category.name }}
      </button>
    </div>
  </div>

  <slot />

  <div v-if="shareableTask || sharedTasks.length" class="sharing-panel">
    <button v-if="shareableTask" type="button" class="btn ghost" @click="emit('openShare')">Share task</button>
    <div v-for="row in sharedTasks" :key="row.invitation.id" class="shared-task-row" aria-label="Task invitation">
      <span class="shared-task-icon" aria-hidden="true">🔔</span>
      <div class="shared-task-copy">
        <strong>Task invitation</strong>
        <small>{{ userName(row.invitation.senderId) }} invited you to join “{{ row.task.title }}”.</small>
      </div>
      <button type="button" class="btn sm primary" @click="emit('acceptInvitation', row.invitation.id)">Join</button>
    </div>
  </div>
</template>
