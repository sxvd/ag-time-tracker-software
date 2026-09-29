<script setup lang="ts">
import TaskComposer from '~/features/tasks/TaskComposer.vue'
import type { ApiCategory, ApiEntry, ApiInvitation, ApiTask } from '~/types/api'

withDefaults(defineProps<{
  activeEntry: ApiEntry | null
  activeTaskTitle: string
  categories: ApiCategory[]
  categoryName: (categoryId: string) => string
  contextSwitches: number
  currentCategoryName: string
  elapsedSeconds: number
  hasInlineTaskTitle: boolean
  idleSeconds: number
  inlineCategoryId: string
  isUpdatingPause: boolean
  timerActionError?: string
  pausedAt: string | null
  primaryTimerLabel: string
  shareableTask: ApiTask | null
  sharedTasks: Array<{ invitation: ApiInvitation, task: ApiTask }>
  userName: (userId: string) => string
}>(), {
  timerActionError: ''
})

const emit = defineEmits<{
  acceptInvitation: [invitationId: string]
  draftChange: []
  openShare: []
  primaryAction: []
  selectCategory: [categoryId: string]
  stop: []
}>()

const inlineTaskTitle = defineModel<string>('inlineTaskTitle', { required: true })
const taskComposer = ref<{ focusTaskInput: () => void } | null>(null)

function focusTaskInput() {
  taskComposer.value?.focusTaskInput()
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, seconds)
  const h = Math.floor(safe / 3600).toString().padStart(2, '0')
  const m = Math.floor((safe % 3600) / 60).toString().padStart(2, '0')
  const s = Math.floor(safe % 60).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

defineExpose({ focusTaskInput })
</script>

<template>
  <article class="card pad timer-panel">
    <div class="card-h">
      <div>
        <p class="eyebrow">Tracking</p>
        <h2>{{ activeTaskTitle || inlineTaskTitle || 'Start your task' }}</h2>
      </div>
    </div>

    <TaskComposer
      ref="taskComposer"
      v-model:title="inlineTaskTitle"
      :categories="categories"
      :inline-category-id="inlineCategoryId"
      :shareable-task="shareableTask"
      :shared-tasks="sharedTasks"
      :user-name="userName"
      @draft-change="emit('draftChange')"
      @select-category="emit('selectCategory', $event)"
      @open-share="emit('openShare')"
      @accept-invitation="emit('acceptInvitation', $event)"
    >
      <div class="timer-face">
        <div class="timer-display-row">
          <div class="timer-readout mono">{{ activeEntry ? formatDuration(elapsedSeconds) : '00:00:00' }}</div>
          <button
            type="button"
            class="timer-primary-button"
            :class="{ 'is-start': !activeEntry, 'is-break': activeEntry && !pausedAt, 'is-resume': pausedAt }"
            :disabled="(!hasInlineTaskTitle && !activeEntry) || isUpdatingPause"
            :aria-label="primaryTimerLabel"
            :title="primaryTimerLabel"
            @click="emit('primaryAction')"
          >
            <span
              class="timer-action-icon"
              :class="activeEntry && !pausedAt ? 'is-pause' : 'is-play'"
              aria-hidden="true"
            ></span>
          </button>
          <button v-if="activeEntry" type="button" class="btn orange timer-stop-button" @click="emit('stop')">Stop</button>
        </div>
        <p v-if="timerActionError" class="form-error" role="alert">{{ timerActionError }}</p>
      </div>

      <dl class="timer-stats">
        <div>
          <svg class="timer-stat-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="m20 13-7 7a2 2 0 0 1-2.8 0L4 13.8V4h9.8L20 10.2a2 2 0 0 1 0 2.8Z"></path>
            <circle cx="8.5" cy="8.5" r="1.25"></circle>
          </svg>
          <dt>Task category</dt>
          <dd>{{ categoryName(inlineCategoryId) || currentCategoryName || 'Unselected' }}</dd>
        </div>
        <div>
          <svg class="timer-stat-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="8.5"></circle>
            <path d="M12 7.5V12l3 2"></path>
          </svg>
          <dt>Inactive time</dt>
          <dd>{{ Math.round(idleSeconds / 60) }}m</dd>
        </div>
        <div>
          <svg class="timer-stat-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6 7h12m0 0-3-3m3 3-3 3M18 17H6m0 0 3 3m-3-3 3-3"></path>
          </svg>
          <dt>Context switches</dt>
          <dd>{{ contextSwitches }}</dd>
        </div>
      </dl>
    </TaskComposer>
  </article>
</template>
