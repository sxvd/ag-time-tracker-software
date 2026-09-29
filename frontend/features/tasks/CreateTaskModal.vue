<script setup lang="ts">
import type { ApiCategory, ApiCollaborator } from '~/types/api'
import type { TaskFormDraft } from './useTasks'

defineProps<{
  categories: ApiCategory[]
  users: ApiCollaborator[]
  shareButtonLabel: string
}>()

const emit = defineEmits<{
  close: []
  submit: []
}>()

const form = defineModel<TaskFormDraft>('form', { required: true })
const pickerOpen = defineModel<boolean>('pickerOpen', { required: true })
const selectedUserIds = defineModel<string[]>('selectedUserIds', { required: true })
</script>

<template>
  <div class="modal-backdrop">
    <form class="task-modal" @submit.prevent="emit('submit')">
      <div class="modal-title-row">
        <h2>Create team task</h2>
        <button type="button" class="icon-close" aria-label="Close create team task" @click="emit('close')">x</button>
      </div>
      <p class="sub">Choose at least one teammate. The task will appear under Team entries without starting the timer.</p>
      <input v-model="form.title" required placeholder="Task title" aria-label="Task title">
      <textarea v-model="form.description" rows="3" placeholder="Description" aria-label="Task description"></textarea>
      <select v-model="form.categoryId" aria-label="Category">
        <option disabled value="">Categories</option>
        <option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option>
      </select>
      <button
        type="button"
        class="btn team-picker-trigger"
        aria-describedby="team-member-help"
        :aria-expanded="pickerOpen"
        @click="pickerOpen = !pickerOpen"
      >{{ shareButtonLabel }}</button>
      <p id="team-member-help" class="form-help">At least one teammate is required.</p>
      <div v-if="pickerOpen" class="share-picker">
        <label v-for="user in users" :key="user.id" class="check">
          <input v-model="selectedUserIds" type="checkbox" :value="user.id">
          {{ user.displayName }} <span>{{ user.team }}</span>
        </label>
        <p v-if="!users.length" class="empty">No teammates are available yet. Ask them to sign in first.</p>
      </div>
      <button type="submit" class="btn primary" :disabled="selectedUserIds.length === 0">Add team task</button>
    </form>
  </div>
</template>
