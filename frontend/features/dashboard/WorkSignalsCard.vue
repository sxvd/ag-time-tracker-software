<script setup lang="ts">
import type { ApiPersonalDashboard } from '~/types/api'
import { buildPersonalSignal } from './personal-dashboard-view'

const props = defineProps<{
  efficiency: ApiPersonalDashboard['efficiency']
  energy: ApiPersonalDashboard['energy']
  subtitle?: string
  secondTitle?: string
  efficiencyEmptyMessage?: string
  secondEmptyMessage?: string
  embedded?: boolean
}>()

const signals = computed(() => [
  {
    key: 'efficiency',
    title: 'Efficiency',
    emptyMessage: props.efficiencyEmptyMessage || 'No efficiency feedback recorded yet.',
    presentation: buildPersonalSignal(props.efficiency)
  },
  {
    key: 'energy',
    title: props.secondTitle || 'Energy',
    emptyMessage: props.secondEmptyMessage || 'No energy feedback recorded yet.',
    presentation: buildPersonalSignal(props.energy)
  }
])
</script>

<template>
  <component :is="embedded ? 'section' : 'article'" :class="embedded ? 'work-signals-embedded' : 'card pad work-signals-card'">
    <div>
      <h2>Work signals</h2>
      <p class="sub">{{ subtitle || 'How your completed sessions felt this week' }}</p>
    </div>

    <section
      v-for="signal in signals"
      :key="signal.key"
      class="work-signal-group"
      :aria-labelledby="`work-signal-${signal.key}`"
    >
      <div class="work-signal-header">
        <h3 :id="`work-signal-${signal.key}`">{{ signal.title }}</h3>
        <span v-if="signal.presentation.total">{{ signal.presentation.total }} {{ signal.presentation.total === 1 ? 'response' : 'responses' }}</span>
      </div>
      <div
        v-if="signal.presentation.items.length"
        class="work-signal-bar"
        role="img"
        :aria-label="signal.presentation.items.map(item => `${item.name} ${item.percentage}%`).join(', ')"
      >
        <span
          v-for="item in signal.presentation.items"
          :key="item.name"
          :style="{ width: `${item.percentage}%` }"
        />
      </div>
      <div v-if="signal.presentation.items.length" class="personal-signal-legend" role="list">
        <div v-for="item in signal.presentation.items" :key="item.name" class="personal-signal-item" role="listitem">
          <span class="personal-signal-name">{{ item.name }}</span>
          <span class="personal-signal-value">
            <strong>{{ item.count }}</strong> {{ item.count === 1 ? 'session' : 'sessions' }} · {{ item.percentage }}%
          </span>
        </div>
      </div>
      <p v-else class="empty" role="status">{{ signal.emptyMessage }}</p>
    </section>
  </component>
</template>
