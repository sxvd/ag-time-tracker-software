<script setup lang="ts">
import type { ApiEntry, ApiSharedTaskEffort, ApiTask } from '~/types/api'

type EntryScope = 'Individual' | 'Team'

const props = defineProps<{
  entries: ApiEntry[]
  scope: EntryScope
  teamTasks?: Array<{ task: ApiTask, summary: ApiSharedTaskEffort | null }>
  selectedTaskId?: string
  hasActiveEntry?: boolean
  currentUserId: string
  taskName: (taskId: string) => string
  userName: (userId: string) => string
}>()

const emit = defineEmits<{
  'update:scope': [scope: EntryScope]
  clearTeamTask: []
  edit: [entry: ApiEntry]
  selectTeamTask: [task: ApiTask]
}>()

const pageSize = 5
const currentPage = ref(1)
const teamTaskRows = computed(() => props.teamTasks || [])
const activeRowCount = computed(() => props.scope === 'Team' ? teamTaskRows.value.length : props.entries.length)
const totalPages = computed(() => Math.max(1, Math.ceil(activeRowCount.value / pageSize)))
const pageStart = computed(() => (currentPage.value - 1) * pageSize)
const pageEnd = computed(() => Math.min(pageStart.value + pageSize, activeRowCount.value))
const paginatedEntries = computed(() => props.entries.slice(pageStart.value, pageEnd.value))
const paginatedTeamTasks = computed(() => teamTaskRows.value.slice(pageStart.value, pageEnd.value))

watch(() => props.scope, () => {
  currentPage.value = 1
})

watch(() => props.entries.map(entry => entry.id).join('|'), () => {
  currentPage.value = 1
})

watch(() => teamTaskRows.value.map(row => row.task.id).join('|'), () => {
  currentPage.value = 1
})

function showPreviousEntries() {
  currentPage.value = Math.max(1, currentPage.value - 1)
}

function showNextEntries() {
  currentPage.value = Math.min(totalPages.value, currentPage.value + 1)
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, seconds)
  const h = Math.floor(safe / 3600).toString().padStart(2, '0')
  const m = Math.floor((safe % 3600) / 60).toString().padStart(2, '0')
  const s = Math.floor(safe % 60).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

function formatCompactDuration(seconds: number) {
  const safe = Math.max(0, seconds)
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

function memberNames(summary: ApiSharedTaskEffort | null) {
  return summary?.members.map(member => `${member.displayName}${member.role === 'owner' ? ' (owner)' : ''}`).join(', ') || 'Members loading'
}

function teamTaskActionLabel(task: ApiTask) {
  if (props.hasActiveEntry && props.selectedTaskId === task.id) return 'Tracking'
  if (!props.hasActiveEntry && props.selectedTaskId === task.id) return 'Cancel'
  return 'Track task'
}

function teamTaskActionClass(task: ApiTask) {
  return {
    'team-task-action': true,
    'is-selected': !props.hasActiveEntry && props.selectedTaskId === task.id,
    'is-tracking': props.hasActiveEntry && props.selectedTaskId === task.id
  }
}

function handleTeamTaskAction(task: ApiTask) {
  if (props.hasActiveEntry) return
  if (props.selectedTaskId === task.id) emit('clearTeamTask')
  else emit('selectTeamTask', task)
}

function formatEntryTime(value: string | null) {
  if (!value) return 'In progress'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function entryFeeling(entry: ApiEntry) {
  if (!entry.feedback) return 'Skipped feedback'
  return [entry.feedback.flowQuality, entry.feedback.efficiencyFeel, entry.feedback.energy].join(' / ')
}
</script>

<template>
  <article class="card pad sessions-panel">
    <div class="card-h">
      <div>
        <h2>Today's entries</h2>
        <p class="sub">{{ scope === 'Individual' ? 'Your tracked sessions' : 'Shared tasks you joined or own' }}</p>
      </div>
      <div class="segmented" role="group" aria-label="Filter entries">
        <button type="button" :class="{ selected: scope === 'Individual' }" @click="emit('update:scope', 'Individual')">Individual</button>
        <button type="button" :class="{ selected: scope === 'Team' }" @click="emit('update:scope', 'Team')">Team</button>
      </div>
    </div>

    <p v-if="!activeRowCount" class="empty">{{ scope === 'Individual' ? 'No tracked time yet today. Add a task to begin.' : 'No team tasks yet. Join or share a task to see it here.' }}</p>
    <div v-else class="entry-table-scroll">
      <table
        class="entry-table"
        :class="{ 'entry-table-team': scope === 'Team' }"
        :aria-label="scope === 'Individual' ? `Today's individual entries` : `Today's team entries`"
      >
        <thead>
          <tr v-if="scope === 'Individual'">
            <th scope="col">Task</th>
            <th scope="col">Time spent</th>
            <th scope="col">Start → Finish</th>
            <th scope="col">Feeling</th>
            <th scope="col" class="entry-controls-heading">
              <span class="visually-hidden">Entry controls</span>
            </th>
          </tr>
          <tr v-else>
            <th scope="col">Task</th>
            <th scope="col">Members</th>
            <th scope="col">My time spent</th>
            <th scope="col" class="entry-controls-heading">
              <span class="visually-hidden">Team task controls</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-if="scope === 'Individual'">
            <tr v-for="entry in paginatedEntries" :key="entry.id">
              <th scope="row">{{ taskName(entry.taskId) }}</th>
              <td class="entry-duration">{{ formatDuration(entry.durationSeconds) }}</td>
              <td>
                <div class="entry-time-range">
                  <time :datetime="entry.startedAt">{{ formatEntryTime(entry.startedAt) }}</time>
                  <span aria-hidden="true">→</span>
                  <time v-if="entry.endedAt" :datetime="entry.endedAt">{{ formatEntryTime(entry.endedAt) }}</time>
                  <span v-else>In progress</span>
                </div>
              </td>
              <td>
                <div class="entry-feeling-details">
                  <strong>{{ entryFeeling(entry) }}</strong>
                  <small v-if="entry.feedback?.note">{{ entry.feedback.note }}</small>
                  <div v-if="entry.isManual || entry.isEdited" class="entry-statuses" aria-label="Entry status">
                    <small v-if="entry.isManual">Manual</small>
                    <small v-if="entry.isEdited">Edited</small>
                  </div>
                </div>
              </td>
              <td class="entry-action">
                <button
                  v-if="entry.userId === currentUserId && entry.endedAt"
                  type="button"
                  class="entry-icon-button"
                  :aria-label="`Edit ${taskName(entry.taskId)} entry`"
                  title="Edit entry"
                  @click="emit('edit', entry)"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z" />
                    <path d="m13.5 6.5 4 4" />
                  </svg>
                </button>
                <span v-else aria-hidden="true">—</span>
              </td>
            </tr>
          </template>
          <template v-else>
            <tr v-for="row in paginatedTeamTasks" :key="row.task.id">
              <th scope="row">{{ row.task.title }}</th>
              <td>{{ memberNames(row.summary) }}</td>
              <td class="entry-duration">{{ formatCompactDuration(row.summary?.myDurationSeconds || 0) }}</td>
              <td class="entry-action">
                <button
                  type="button"
                  class="btn sm"
                  :class="teamTaskActionClass(row.task)"
                  :disabled="hasActiveEntry"
                  @click="handleTeamTaskAction(row.task)"
                >
                  {{ teamTaskActionLabel(row.task) }}
                </button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <nav v-if="activeRowCount" class="entry-pagination" aria-label="Today's entries pages">
      <button
        type="button"
        class="entry-page-button"
        aria-label="Previous entries"
        title="Previous entries"
        :disabled="currentPage === 1"
        @click="showPreviousEntries"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m15 6-6 6 6 6" />
        </svg>
      </button>
      <span
        class="entry-pagination-status"
        aria-live="polite"
        :aria-label="`Page ${currentPage} of ${totalPages}`"
      >
        {{ currentPage }} / {{ totalPages }}
      </span>
      <button
        type="button"
        class="entry-page-button"
        aria-label="Next entries"
        title="Next entries"
        :disabled="currentPage === totalPages"
        @click="showNextEntries"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
    </nav>
  </article>
</template>
