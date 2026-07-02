<script setup lang="ts">
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js'
import { Bar, Line } from 'vue-chartjs'

const props = defineProps<{ type?: 'bar' | 'line', labels: string[], values: number[], label: string, color?: string }>()
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend)

const chartData = computed(() => ({
  labels: props.labels,
  datasets: [{ label: props.label, data: props.values, backgroundColor: props.color || '#1C75BC', borderColor: props.color || '#1C75BC', borderWidth: 2, tension: 0.35 }]
}))

const options = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
</script>

<template>
  <div class="chart-box">
    <ClientOnly>
      <Line v-if="type === 'line'" :data="chartData" :options="options" />
      <Bar v-else :data="chartData" :options="options" />
    </ClientOnly>
  </div>
</template>
