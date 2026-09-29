<script setup lang="ts">
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js'
import { Bar, Line } from 'vue-chartjs'
import type { PersonalOverviewChartType, PersonalOverviewDataset } from './personal-dashboard-view'

const props = defineProps<{
  type: PersonalOverviewChartType
  labels: string[]
  datasets: PersonalOverviewDataset[]
  unit: string
  description: string
  precision: number
}>()

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend)

const { resolvedTheme } = useTheme()

const palette = computed(() => resolvedTheme.value === 'dark'
  ? {
      text: '#b3c4d3',
      grid: 'rgba(132, 153, 169, 0.16)',
      tooltip: '#223342'
    }
  : {
      text: '#46586a',
      grid: 'rgba(108, 125, 141, 0.16)',
      tooltip: '#182430'
    })

const chartData = computed(() => ({
  labels: props.labels,
  datasets: props.datasets.map(dataset => ({
    label: dataset.label,
    data: dataset.values,
    backgroundColor: dataset.color,
    borderColor: dataset.color,
    borderWidth: 2,
    borderRadius: props.type === 'bar' ? 3 : 0,
    maxBarThickness: 24,
    pointRadius: props.type === 'line' ? 3 : 0,
    pointHoverRadius: props.type === 'line' ? 5 : 0,
    tension: 0.3,
    fill: false
  }))
}))

const options = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: {
      display: true,
      position: 'bottom' as const,
      labels: {
        color: palette.value.text,
        usePointStyle: true,
        boxWidth: 8,
        padding: 20
      }
    },
    tooltip: {
      backgroundColor: palette.value.tooltip,
      titleColor: '#eaf2fa',
      bodyColor: '#eaf2fa',
      padding: 11
    }
  },
  scales: {
    x: {
      grid: { color: palette.value.grid },
      ticks: { color: palette.value.text }
    },
    y: {
      beginAtZero: true,
      grid: { color: palette.value.grid },
      title: { color: palette.value.text, display: true, text: props.unit },
      ticks: { color: palette.value.text, precision: props.precision }
    }
  }
}))
</script>

<template>
  <div class="chart-box work-overview-chart" role="img" :aria-label="description">
    <ClientOnly>
      <Line v-if="type === 'line'" :data="chartData" :options="options" />
      <Bar v-else :data="chartData" :options="options" />
    </ClientOnly>
  </div>
</template>
