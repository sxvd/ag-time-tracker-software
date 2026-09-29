<script setup lang="ts">
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js'
import { Bar, Line } from 'vue-chartjs'

const props = withDefaults(defineProps<{
  type?: 'bar' | 'line'
  labels: string[]
  values: number[]
  label: string
  color?: string
  description?: string
  precision?: number
}>(), {
  type: 'bar',
  color: '#1C75BC',
  description: '',
  precision: 0
})
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend)

const chartData = computed(() => ({
  labels: props.labels,
  datasets: [{ label: props.label, data: props.values, backgroundColor: props.color, borderColor: props.color, borderWidth: 2, tension: 0.35 }]
}))

const options = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true, ticks: { precision: props.precision } } }
}))
</script>

<template>
  <div class="chart-box" role="img" :aria-label="description || `${label} chart`">
    <ClientOnly>
      <Line v-if="type === 'line'" :data="chartData" :options="options" />
      <Bar v-else :data="chartData" :options="options" />
    </ClientOnly>
  </div>
</template>
