<script setup lang="ts">
import { ChartBarIcon, ChevronLeftIcon, ChevronRightIcon, PresentationChartLineIcon } from '@heroicons/vue/24/outline'
import MedalCollection from '~/features/medals/MedalCollection.vue'
import WorkSignalsCard from './WorkSignalsCard.vue'
import BlockerPatternsCard from './BlockerPatternsCard.vue'
import WorkOverviewChart from './WorkOverviewChart.vue'
import {
  buildPersonalOverview,
  personalBreakdownOptions,
  type PersonalBreakdownView,
  type PersonalOverviewChartType,
  type PersonalOverviewMetric
} from './personal-dashboard-view'
import type { ApiMedal, ApiPersonalDashboard } from '~/types/api'
import { formatTrackedDuration } from '~~/shared/utils/time'

const props = defineProps<{
  dashboard: ApiPersonalDashboard
  medals: ApiMedal[]
}>()

const selectedMetric = ref<PersonalOverviewMetric>('time')
const selectedGrouping = ref<PersonalBreakdownView>('category')
const selectedChartType = ref<PersonalOverviewChartType>('bar')
const selectedWeekStart = ref('')

const currentWeekStart = computed(() => weekStartKey(new Date()))
const weeks = computed(() => (props.dashboard.weeks || []).filter(week => week.weekStart <= currentWeekStart.value))
const selectedWeekIndex = computed(() => weeks.value.findIndex(week => week.weekStart === selectedWeekStart.value))
const selectedWeek = computed(() => weeks.value[selectedWeekIndex.value])
const overview = computed(() => buildPersonalOverview(selectedWeek.value, selectedMetric.value, selectedGrouping.value))
const formattedTotalTime = computed(() => formatTrackedDuration(selectedWeek.value?.totalSeconds || 0))

watch(weeks, (availableWeeks) => {
  if (!availableWeeks.some(week => week.weekStart === selectedWeekStart.value)) {
    selectedWeekStart.value = availableWeeks.at(-1)?.weekStart || ''
  }
}, { immediate: true })

function moveWeek(offset: number) {
  const next = weeks.value[selectedWeekIndex.value + offset]
  if (next) selectedWeekStart.value = next.weekStart
}

function weekStartKey(value: Date) {
  const date = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
  const mondayOffset = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - mondayOffset)
  return date.toISOString().slice(0, 10)
}
</script>

<template>
  <section class="dashboard-grid personal-dashboard-grid">
    <article class="card pad personal-work-overview-card">
      <header class="personal-overview-heading">
        <section class="personal-overview-summary" aria-labelledby="personal-hours-title">
          <div>
            <h2 id="personal-hours-title">Your hours</h2>
            <small>{{ selectedWeek ? `Selected week · ${selectedWeek.label}` : 'Selected week' }}</small>
          </div>
          <strong>{{ formattedTotalTime }}</strong>
        </section>
        <div class="personal-overview-intro">
          <h2>Work overview</h2>
          <p>Analyze how your selected week was spent</p>
        </div>
      </header>
      <div class="personal-overview-controls">
        <label>
          <span>Metric</span>
          <select v-model="selectedMetric">
            <option value="time">Tracked time</option>
            <option value="sessions">Work entries</option>
          </select>
        </label>
        <label>
          <span>Group by</span>
          <select v-model="selectedGrouping">
            <option v-for="option in personalBreakdownOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <div class="personal-week-control">
          <span>Week</span>
          <div>
            <button type="button" :disabled="selectedWeekIndex <= 0" aria-label="Previous week" title="Previous week" @click="moveWeek(-1)">
              <ChevronLeftIcon aria-hidden="true" />
              <span class="visually-hidden">Previous</span>
            </button>
            <select v-model="selectedWeekStart" aria-label="Selected week">
              <option v-if="!weeks.length" value="">No tracked weeks</option>
              <option v-for="week in weeks" :key="week.weekStart" :value="week.weekStart">{{ week.label }}</option>
            </select>
            <button type="button" :disabled="selectedWeekIndex < 0 || selectedWeekIndex >= weeks.length - 1" aria-label="Next week" title="Next week" @click="moveWeek(1)">
              <ChevronRightIcon aria-hidden="true" />
              <span class="visually-hidden">Next</span>
            </button>
          </div>
        </div>
        <div class="personal-chart-type" role="group" aria-label="Chart type">
          <button type="button" :class="{ active: selectedChartType === 'bar' }" :aria-pressed="selectedChartType === 'bar'" aria-label="Bar chart" title="Bar chart" @click="selectedChartType = 'bar'">
            <ChartBarIcon aria-hidden="true" />
            <span class="visually-hidden">Bar</span>
          </button>
          <button type="button" :class="{ active: selectedChartType === 'line' }" :aria-pressed="selectedChartType === 'line'" aria-label="Line chart" title="Line chart" @click="selectedChartType = 'line'">
            <PresentationChartLineIcon aria-hidden="true" />
            <span class="visually-hidden">Line</span>
          </button>
        </div>
      </div>
      <p class="overview-metric-note">
        {{ selectedMetric === 'sessions'
          ? 'Work entries count saved timer or manual entries, not hours.'
          : 'Tracked time shows the total hours saved for each day.'
        }}
      </p>

      <h3 id="personal-overview-title" class="personal-overview-title">{{ overview.title }}</h3>
      <div class="dashboard-breakdown-content" aria-live="polite">
        <WorkOverviewChart
          v-if="overview.datasets.length"
          :key="`${selectedWeekStart}-${selectedMetric}-${selectedGrouping}-${selectedChartType}`"
          :type="selectedChartType"
          :labels="overview.labels"
          :datasets="overview.datasets"
          :unit="overview.unit"
          :description="overview.description"
          :precision="overview.precision"
        />
        <p v-else class="empty" role="status">{{ overview.emptyMessage }}</p>
      </div>
      <p class="personal-overview-insight">
        <ChartBarIcon aria-hidden="true" />
        <span>{{ overview.insight }}</span>
      </p>
    </article>

    <div class="personal-reflection-rail">
      <WorkSignalsCard class="personal-signals-card" :efficiency="selectedWeek?.efficiency || []" :energy="selectedWeek?.energy || []" />
      <BlockerPatternsCard class="personal-blockers-card" :blockers="selectedWeek?.blockers || []" />
      <MedalCollection class="personal-medals-card" :medals="medals" />
    </div>
  </section>
</template>
