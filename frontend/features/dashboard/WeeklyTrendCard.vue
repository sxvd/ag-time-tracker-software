<script setup lang="ts">
import MetricChart from '~/components/MetricChart.vue'
import type { ApiPersonalDashboard } from '~/types/api'
import { buildPersonalTrend } from './personal-dashboard-view'

const props = defineProps<{
  trend: ApiPersonalDashboard['trend']
}>()

const presentation = computed(() => buildPersonalTrend(props.trend))
</script>

<template>
  <article class="card pad wide weekly-trend-card">
    <div>
      <h2>Weekly trend</h2>
      <p class="sub">Tracked time · hours</p>
    </div>
    <MetricChart
      v-if="presentation.values.length"
      type="line"
      :labels="presentation.labels"
      :values="presentation.values"
      label="Hours"
      :description="presentation.description"
      :precision="1"
    />
    <p v-else class="empty" role="status">{{ presentation.emptyMessage }}</p>
  </article>
</template>
