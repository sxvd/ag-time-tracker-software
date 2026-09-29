<script setup lang="ts">
import type { ApiJourneyDay } from '~/types/api'
import { latestPersonalBreezyDay } from './personal-dashboard-view'

const props = defineProps<{
  journey: ApiJourneyDay[]
}>()

const emit = defineEmits<{
  openJourney: []
}>()

const latestDay = computed(() => latestPersonalBreezyDay(props.journey))
const formattedDate = computed(() => {
  if (!latestDay.value) return ''
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${latestDay.value.date}T00:00:00.000Z`))
})
</script>

<template>
  <article class="card pad breezy-day-card">
    <div>
      <h2>Breezy day</h2>
      <p class="sub">Your latest saved workday</p>
    </div>

    <div v-if="latestDay" class="breezy-day-summary">
      <strong class="breezy-day-mood">{{ latestDay.mood }}</strong>
      <dl class="breezy-day-details">
        <div>
          <dt>Air clarity</dt>
          <dd>{{ latestDay.airClarityScore }}/100</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd><time :datetime="latestDay.date">{{ formattedDate }}</time></dd>
        </div>
      </dl>
      <p class="breezy-day-week">{{ latestDay.weekLabel }}</p>
    </div>
    <p v-else class="empty" role="status">Your first Breezy day will appear after meaningful tracked work.</p>

    <button type="button" class="btn primary" @click="emit('openJourney')">Open Breezy Journey</button>
  </article>
</template>
