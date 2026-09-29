<script setup lang="ts">
import type { ApiCollaborator, ApiTask } from '~/types/api'

defineProps<{
  task: ApiTask
  users: ApiCollaborator[]
  invitationForRecipient: (userId: string) => string
}>()

const emit = defineEmits<{
  close: []
  share: []
}>()

const selectedUserIds = defineModel<string[]>('selectedUserIds', { required: true })

function userInitials(displayName: string) {
  return displayName.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()
}
</script>

<template>
  <div class="modal-backdrop">
    <section class="task-modal share-modal" aria-modal="true" role="dialog" aria-labelledby="share-task-title">
      <div class="modal-title-row">
        <div>
          <h2 id="share-task-title">Share task</h2>
          <p>{{ task.title }}</p>
        </div>
        <button type="button" class="icon-close" aria-label="Close share task" @click="emit('close')">x</button>
      </div>

      <div class="share-user-grid">
        <label v-for="user in users" :key="user.id" class="share-user-card">
          <input v-model="selectedUserIds" type="checkbox" :value="user.id" :disabled="invitationForRecipient(user.id) === 'pending'">
          <span class="share-user-avatar">{{ userInitials(user.displayName) }}</span>
          <span class="share-user-copy">
            <strong>{{ user.displayName }}</strong>
            <em>{{ user.team }}</em>
          </span>
          <span v-if="invitationForRecipient(user.id)" class="invite-chip">{{ invitationForRecipient(user.id) }}</span>
        </label>
        <p v-if="!users.length" class="empty">No teammates are available yet.</p>
      </div>

      <button type="button" class="btn primary" :disabled="!selectedUserIds.length" @click="emit('share')">
        {{ selectedUserIds.length ? `Send invite to ${selectedUserIds.length}` : 'Select user' }}
      </button>
    </section>
  </div>
</template>
