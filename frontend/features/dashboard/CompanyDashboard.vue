<script setup lang="ts">
import { ChartBarIcon, ChevronLeftIcon, ChevronRightIcon, PresentationChartLineIcon } from '@heroicons/vue/24/outline'
import WorkOverviewChart from './WorkOverviewChart.vue'
import WorkSignalsCard from './WorkSignalsCard.vue'
import BlockerPatternsCard from './BlockerPatternsCard.vue'
import {
  buildCompanyBlockers,
  buildCompanyOverview,
  companyScopeLabel,
  type CompanyOverviewChartType
} from './company-dashboard-view'
import type { ApiCompanyDashboard } from '~/types/api'
import { formatTrackedDuration } from '~~/shared/utils/time'

type CompanyMetric = ApiCompanyDashboard['overview']['metric']
type CompanyGrouping = ApiCompanyDashboard['overview']['groupBy']

const props = defineProps<{
  dashboard: ApiCompanyDashboard | null
  categoryId: string
  metric: CompanyMetric
  groupBy: CompanyGrouping
  chartType: CompanyOverviewChartType
  loading: boolean
  error: string
}>()

const emit = defineEmits<{
  'update:categoryId': [value: string]
  'update:metric': [value: CompanyMetric]
  'update:groupBy': [value: CompanyGrouping]
  'update:chartType': [value: CompanyOverviewChartType]
  'update:weekStart': [value: string]
  refresh: []
}>()

const overview = computed(() => props.dashboard ? buildCompanyOverview(props.dashboard) : null)
const blockers = computed(() => props.dashboard ? buildCompanyBlockers(props.dashboard.blockers) : [])
const selectedScope = computed(() => props.dashboard ? companyScopeLabel(props.dashboard) : 'All categories')
const formattedTotalTime = computed(() => formatTrackedDuration(props.dashboard?.totalSeconds || 0))
const activeSharedCount = computed(() => props.dashboard?.activeSharedSessionCount || 0)
const activeSharedHeadline = computed(() => `${activeSharedCount.value} active shared`)
const activeSharedUnit = computed(() => activeSharedCount.value === 1 ? 'session' : 'sessions')
const currentWeekStart = computed(() => weekStartKey(new Date()))
const canMoveToNextWeek = computed(() => Boolean(props.dashboard && props.dashboard.week.start < currentWeekStart.value))
const filterStatus = computed(() => {
  if (props.loading) return 'Updating ' + selectedScope.value + ' company data…'
  return props.error
})

function refresh(change: () => void) {
  change()
  emit('refresh')
}

function moveWeek(offset: number) {
  const current = props.dashboard?.week.start
  if (!current) return
  if (offset > 0 && !canMoveToNextWeek.value) return
  const next = new Date(current + 'T00:00:00.000Z')
  next.setUTCDate(next.getUTCDate() + offset * 7)
  const nextKey = next.toISOString().slice(0, 10)
  emit('update:weekStart', nextKey > currentWeekStart.value ? currentWeekStart.value : nextKey)
  emit('refresh')
}

function weekStartKey(value: Date) {
  const date = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
  const mondayOffset = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - mondayOffset)
  return date.toISOString().slice(0, 10)
}
</script>

<template>
  <section class="dashboard-grid company-dashboard-grid" :aria-busy="loading">
    <article class="card pad company-main-card">
      <section class="company-overview-section" aria-label="Company overview">
        <div class="company-filter-stack">
          <div class="company-filter-panel">
            <label for="company-category-filter">Category scope
              <select
                id="company-category-filter"
                :value="categoryId"
                :disabled="loading || !dashboard"
                aria-describedby="company-filter-help company-filter-status"
                @change="refresh(() => emit('update:categoryId', ($event.target as HTMLSelectElement).value))"
              >
                <option value="">All categories</option>
                <option v-for="category in dashboard?.availableCategories || []" :key="category.id" :value="category.id">{{ category.name }}</option>
              </select>
            </label>
            <p id="company-filter-help" class="company-summary-help">All company results stay aggregated.</p>
          </div>
          <p
            id="company-filter-status"
            class="company-filter-status"
            :class="{ 'form-error': error }"
            :role="error ? 'alert' : 'status'"
            aria-live="polite"
          >{{ filterStatus }}</p>
        </div>

        <section class="company-hours-summary" aria-labelledby="company-hours-title">
          <div class="company-hours-heading">
            <h2 id="company-hours-title">Company hours</h2>
            <small>{{ dashboard ? '· ' + dashboard.week.label : 'Selected week' }}</small>
          </div>
          <strong>{{ formattedTotalTime }}</strong>
        </section>
      </section>

      <div class="company-main-divider" aria-hidden="true" />

      <section class="company-work-overview-section" aria-labelledby="company-work-overview-title">
        <header class="personal-overview-intro">
          <h2 id="company-work-overview-title">Work overview</h2>
          <p>Daily company activity and patterns</p>
        </header>
        <div class="personal-overview-controls">
          <label>
            <span>Metric</span>
            <select
              :value="metric"
              :disabled="loading || !dashboard"
              @change="refresh(() => emit('update:metric', ($event.target as HTMLSelectElement).value as CompanyMetric))"
            >
              <option value="trackedTime">Tracked time</option>
              <option value="sessions">Work entries</option>
              <option value="contextSwitches">Context switches</option>
            </select>
          </label>
          <label>
            <span>Group by</span>
            <select
              :value="groupBy"
              :disabled="loading || !dashboard"
              @change="refresh(() => emit('update:groupBy', ($event.target as HTMLSelectElement).value as CompanyGrouping))"
            >
              <option value="category">Category</option>
              <option value="flow">Flow</option>
              <option value="efficiency">Efficiency</option>
            </select>
          </label>
          <div class="personal-week-control">
            <span>Week</span>
            <div>
              <button type="button" :disabled="loading || !dashboard" aria-label="Previous week" title="Previous week" @click="moveWeek(-1)">
                <ChevronLeftIcon aria-hidden="true" />
                <span class="visually-hidden">Previous</span>
              </button>
              <span class="company-week-label">{{ dashboard?.week.label || 'No tracked weeks' }}</span>
              <button type="button" :disabled="loading || !dashboard || !canMoveToNextWeek" aria-label="Next week" title="Next week" @click="moveWeek(1)">
                <ChevronRightIcon aria-hidden="true" />
                <span class="visually-hidden">Next</span>
              </button>
            </div>
          </div>
          <div class="personal-chart-type" role="group" aria-label="Chart type">
            <button type="button" :disabled="loading || !dashboard" :class="{ active: chartType === 'bar' }" :aria-pressed="chartType === 'bar'" aria-label="Bar chart" title="Bar chart" @click="emit('update:chartType', 'bar')">
              <ChartBarIcon aria-hidden="true" />
              <span class="visually-hidden">Bar</span>
            </button>
            <button type="button" :disabled="loading || !dashboard" :class="{ active: chartType === 'line' }" :aria-pressed="chartType === 'line'" aria-label="Line chart" title="Line chart" @click="emit('update:chartType', 'line')">
              <PresentationChartLineIcon aria-hidden="true" />
              <span class="visually-hidden">Line</span>
            </button>
          </div>
        </div>
        <p class="overview-metric-note">
          {{ metric === 'sessions'
            ? 'Work entries count saved timer or manual entries, not hours.'
            : metric === 'trackedTime'
              ? 'Tracked time shows aggregate hours for the selected category scope.'
              : 'Context switches show counts only; no app names or URLs are stored.'
          }}
        </p>

        <div v-if="overview" class="dashboard-breakdown-content" aria-live="polite">
          <h3 class="personal-overview-title">{{ overview.title }}</h3>
          <WorkOverviewChart
            v-if="overview.datasets.length"
            :key="[dashboard?.week.start, metric, groupBy, chartType].join('-')"
            :type="chartType"
            :labels="overview.labels"
            :datasets="overview.datasets"
            :unit="overview.unit"
            :description="overview.description"
            :precision="overview.precision"
          />
          <p v-else class="empty" role="status">{{ overview.emptyMessage }}</p>
          <p class="personal-overview-insight">
            <ChartBarIcon aria-hidden="true" />
            <span>{{ overview.insight }}</span>
          </p>
        </div>
        <p v-else class="empty" role="status">Loading company overview…</p>
      </section>
    </article>

    <aside class="company-side-column" aria-label="Company reflection signals and blocker patterns">
      <article class="card pad company-active-card" aria-labelledby="company-active-title">
        <div>
          <h2 id="company-active-title">Active shared</h2>
          <p class="sub">Shared tasks in progress</p>
        </div>
        <strong>{{ activeSharedHeadline }}</strong>
        <span>{{ activeSharedUnit }}</span>
      </article>
      <WorkSignalsCard
        :efficiency="dashboard?.efficiency || []"
        :energy="dashboard?.flow || []"
        subtitle="Recorded feedback only"
        second-title="Flow"
        efficiency-empty-message="No efficiency feedback recorded in this week."
        second-empty-message="No flow feedback recorded in this week."
      />
      <BlockerPatternsCard :blockers="blockers" />
    </aside>
  </section>
</template>
