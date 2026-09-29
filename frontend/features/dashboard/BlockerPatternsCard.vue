<script setup lang="ts">
import type { ApiPersonalDashboard } from '~/types/api'
import { buildPersonalBlockers } from './personal-dashboard-view'

const props = defineProps<{
  blockers: ApiPersonalDashboard['blockers']
  embedded?: boolean
}>()

const patterns = computed(() => buildPersonalBlockers(props.blockers))
</script>

<template>
  <component :is="embedded ? 'section' : 'article'" :class="embedded ? 'blocker-patterns-embedded' : 'card pad wide blocker-patterns-card'">
    <div>
      <h2>Blocker patterns</h2>
      <p class="sub">Affected sessions · associated tracked time</p>
    </div>
    <ol v-if="patterns.length" class="blocker-pattern-list">
      <li v-for="pattern in patterns" :key="pattern.name">
        <span class="blocker-pattern-name">{{ pattern.name }}</span>
        <span class="blocker-pattern-value">
          {{ pattern.count }} {{ pattern.count === 1 ? 'session' : 'sessions' }} · {{ pattern.hours }}h
        </span>
      </li>
    </ol>
    <p v-else class="empty" role="status">Clear skies — no blockers logged.</p>
  </component>
</template>
