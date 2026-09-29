<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatTrackedDuration } from '~~/shared/utils/time'
import { withAppBase } from '~~/shared/utils/url'
import type { ApiCategory, ApiEntry, ApiJourneyDay, ApiTask } from '~/types/api'

const props = defineProps<{
  journey: ApiJourneyDay[]
  entries?: ApiEntry[]
  tasks?: ApiTask[]
  categories?: ApiCategory[]
}>()

interface JourneySegment {
  id: string
  dateKey: string
  title: string
  category: string
  durationSeconds: number
  mood: string
  clarity: number
  feedback: string
  blocker: string
  breakCount: number
  contextSwitches: number
  colorClass: string
  widthPercent: number
}

const selectedWeekOffset = ref(0)
const activeSegmentId = ref<string | null>(null)

const taskById = computed(() => new Map((props.tasks || []).map(task => [task.id, task])))
const categoryById = computed(() => new Map((props.categories || []).map(category => [category.id, category.name])))
const journeyByDate = computed(() => new Map(props.journey.map(day => [day.date, day])))

const closedEntries = computed(() => (props.entries || [])
  .filter(entry => entry.endedAt)
  .slice()
  .sort((left, right) => left.startedAt.localeCompare(right.startedAt)))

const sourceDates = computed(() => {
  const dates = closedEntries.value.map(entry => dateKey(entry.startedAt))
  if (dates.length) return dates
  return props.journey.map(day => day.date)
})

const availableWeekStarts = computed(() => {
  const weeks = new Set(sourceDates.value.map(date => weekStartKey(date)))
  return [...weeks].sort((left, right) => right.localeCompare(left))
})

const selectedWeekStart = computed(() => {
  const weeks = availableWeekStarts.value
  if (!weeks.length) return weekStartKey(new Date().toISOString().slice(0, 10))
  return weeks[Math.min(selectedWeekOffset.value, weeks.length - 1)] || weeks[0]!
})

const weekRows = computed(() => {
  const days = weekDays(selectedWeekStart.value)
  const segmentsByDate = new Map<string, JourneySegment[]>()

  if (closedEntries.value.length) {
    for (const entry of closedEntries.value) {
      const key = dateKey(entry.startedAt)
      if (!days.some(day => day.key === key)) continue
      const task = taskById.value.get(entry.taskId)
      const category = task ? categoryById.value.get(task.categoryId) || 'Other' : 'Other'
      const breezy = journeyByDate.value.get(key)
      const segmentIndex = segmentsByDate.get(key)?.length || 0
      const segment: JourneySegment = {
        id: entry.id,
        dateKey: key,
        title: task?.title || 'Tracked task',
        category,
        durationSeconds: entry.durationSeconds,
        mood: breezy?.mood || moodFromFeedback(entry.feedback?.flowQuality),
        clarity: breezy?.airClarityScore || 0,
        feedback: entry.feedback?.flowQuality || 'Not recorded',
        blocker: entry.blockers[0] || 'Clear skies',
        breakCount: entry.pauses.filter(pause => (pause.durationSeconds || 0) > 0).length,
        contextSwitches: entry.contextSwitches,
        colorClass: segmentPaletteClass(segmentIndex),
        widthPercent: durationAxisPercent(entry.durationSeconds)
      }
      segmentsByDate.set(key, [...(segmentsByDate.get(key) || []), segment])
    }
  }
  else {
    for (const day of props.journey) {
      if (!days.some(row => row.key === day.date)) continue
      segmentsByDate.set(day.date, [{
        id: `journey-${day.date}`,
        dateKey: day.date,
        title: 'Tracked work',
        category: 'Breezy day',
        durationSeconds: Math.round(day.hours * 3600),
        mood: day.mood,
        clarity: day.airClarityScore,
        feedback: 'Not recorded',
        blocker: 'Clear skies',
        breakCount: 0,
        contextSwitches: 0,
        colorClass: segmentPaletteClass(0),
        widthPercent: durationAxisPercent(Math.round(day.hours * 3600))
      }])
    }
  }

  return days.map(day => {
    const segments = segmentsByDate.get(day.key) || []
    return {
      ...day,
      segments,
      totalSeconds: segments.reduce((sum, segment) => sum + segment.durationSeconds, 0)
    }
  })
})

const summary = computed(() => {
  const segments = weekRows.value.flatMap(row => row.segments)
  const totalSeconds = segments.reduce((sum, segment) => sum + segment.durationSeconds, 0)
  return `${segments.length} ${segments.length === 1 ? 'task' : 'tasks'} · ${formatTrackedDuration(totalSeconds)} tracked`
})

const axisMaxHours = 8
const axisTicks = computed(() => Array.from({ length: axisMaxHours + 1 }, (_, index) => index))
const periodLabel = computed(() => `${shortDate(selectedWeekStart.value)} - ${shortDate(addDaysKey(selectedWeekStart.value, 6))}`)
const canGoOlder = computed(() => selectedWeekOffset.value < availableWeekStarts.value.length - 1)
const canGoNewer = computed(() => selectedWeekOffset.value > 0)
const breezyMarkerUrl = computed(() => withAppBase(useRuntimeConfig().app.baseURL, '/mascots/mascot-journey.png'))

function selectSegment(segment: JourneySegment) {
  activeSegmentId.value = segment.id
}

function closeSegment() {
  activeSegmentId.value = null
}

function goOlder() {
  if (canGoOlder.value) {
    selectedWeekOffset.value += 1
    closeSegment()
  }
}

function goNewer() {
  if (canGoNewer.value) {
    selectedWeekOffset.value -= 1
    closeSegment()
  }
}

function dateKey(value: string) {
  return value.slice(0, 10)
}

function parseUtcDate(key: string) {
  return new Date(`${key}T00:00:00.000Z`)
}

function weekStartKey(key: string) {
  const date = parseUtcDate(key)
  const day = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - day)
  return date.toISOString().slice(0, 10)
}

function addDaysKey(key: string, days: number) {
  const date = parseUtcDate(key)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function weekDays(startKey: string) {
  const weekday = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' })
  const monthDay = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return Array.from({ length: 7 }, (_, index) => {
    const key = addDaysKey(startKey, index)
    const date = parseUtcDate(key)
    return {
      key,
      weekday: weekday.format(date),
      dateLabel: monthDay.format(date)
    }
  })
}

function shortDate(key: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(parseUtcDate(key))
}

function moodFromFeedback(flow?: string) {
  if (flow === 'Great flow') return 'happy'
  if (flow === 'Friction') return 'cloudy'
  return 'calm'
}

function segmentPaletteClass(index: number) {
  const palette = ['blue', 'cyan', 'mint', 'blue', 'lavender']
  return palette[index % palette.length]!
}

function durationAxisPercent(durationSeconds: number) {
  return Math.min(100, Math.max(1.5, (durationSeconds / 3600 / axisMaxHours) * 100))
}
</script>

<template>
  <section class="card pad forest-card journey-card" aria-label="Work Journey weekly completed tasks">
    <div class="journey-controls">
      <p class="journey-record-note">Your completed-task timeline.</p>
      <div class="journey-control-stack">
        <div class="journey-period-control">
          <button type="button" :disabled="!canGoOlder" aria-label="Previous week" @click="goOlder">‹</button>
          <span>{{ periodLabel }}</span>
          <button type="button" :disabled="!canGoNewer" aria-label="Next week" @click="goNewer">›</button>
        </div>
        <strong>{{ summary }}</strong>
      </div>
    </div>

    <div class="journey-timeline" aria-label="Tracked hours by day">
      <template v-for="row in weekRows" :key="row.key">
        <div class="journey-day-label">
          <strong>{{ row.weekday }}</strong>
          <span>{{ row.dateLabel }}</span>
          <small>{{ row.totalSeconds > 0 ? `${formatTrackedDuration(row.totalSeconds)} tracked` : 'No tracked tasks' }}</small>
        </div>

        <div class="journey-day-row">
          <div class="journey-row-guide" aria-hidden="true"></div>
          <template v-if="row.segments.length">
            <div
              v-for="segment in row.segments"
              :key="segment.id"
              class="journey-segment-wrap"
              :style="{ '--segment-width': `${segment.widthPercent}%` }"
            >
              <button
                class="journey-segment"
                :class="[segment.colorClass, { selected: activeSegmentId === segment.id }]"
                type="button"
                :aria-label="`${segment.title}, ${formatTrackedDuration(segment.durationSeconds)}`"
                @click="selectSegment(segment)"
              >
                <span>{{ segment.category }}</span>
              </button>

              <aside v-if="activeSegmentId === segment.id" class="journey-popover" aria-live="polite">
                <div class="journey-popover-head">
                  <strong>{{ segment.title }}</strong>
                  <button type="button" aria-label="Close task memory" @click.stop="closeSegment">×</button>
                </div>
                <div class="journey-popover-meta">
                  <span>▣ {{ shortDate(segment.dateKey) }}</span>
                  <span>◴ {{ formatTrackedDuration(segment.durationSeconds) }}</span>
                </div>
                <dl>
                  <div><dt>Mood</dt><dd>{{ segment.mood }}</dd></div>
                  <div><dt>Feedback</dt><dd>{{ segment.feedback }}</dd></div>
                  <div><dt>Blocker</dt><dd>{{ segment.blocker }}</dd></div>
                </dl>
                <div class="journey-popover-list">
                  <span>{{ segment.breakCount }} {{ segment.breakCount === 1 ? 'break' : 'breaks' }}</span>
                  <span>{{ segment.contextSwitches }} context switches</span>
                </div>
              </aside>
            </div>
            <span class="journey-breezy-marker" aria-hidden="true">
              <img :src="breezyMarkerUrl" alt="">
            </span>
          </template>
        </div>
      </template>

      <div class="journey-axis-spacer"></div>
      <div class="journey-axis">
        <span v-for="tick in axisTicks" :key="tick">{{ tick }}</span>
        <strong>Tracked hours</strong>
      </div>

    </div>

    <div class="journey-legend">
      <div class="journey-palette" aria-hidden="true">
        <span class="journey-swatch blue"></span>
        <span class="journey-swatch cyan"></span>
        <span class="journey-swatch mint"></span>
        <span class="journey-swatch lavender"></span>
      </div>
      <span>Each segment = one completed task memory · Segment length = tracked time</span>
      <span class="journey-help">ⓘ Click a task segment to open its memory.</span>
    </div>
  </section>
</template>
