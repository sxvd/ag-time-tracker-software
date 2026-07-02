<script setup lang="ts">
import type { EfficiencyFeel, EnergyLevel, FlowQuality } from '~~/shared/utils/time'

const emit = defineEmits<{
  save: [payload: { flowQuality: FlowQuality, efficiencyFeel: EfficiencyFeel, energy: EnergyLevel, note: string, blockers: string[] }]
  skip: []
}>()

defineProps<{
  error?: string
  saving?: boolean
}>()

const blockers = ['Waiting on someone', 'Tool was slow or broke', 'Unclear requirements', 'Interruptions', 'Context switching', 'Meetings overran', 'None']
const flowQuality = ref<FlowQuality>('Neutral')
const efficiencyFeel = ref<EfficiencyFeel>('Felt efficient')
const energy = ref<EnergyLevel>('OK')
const note = ref('')
const selectedBlockers = ref<string[]>(['None'])

watch(selectedBlockers, (next) => {
  if (next.length > 1 && next.includes('None')) selectedBlockers.value = next.filter((blocker) => blocker !== 'None')
})

function save() {
  emit('save', {
    flowQuality: flowQuality.value,
    efficiencyFeel: efficiencyFeel.value,
    energy: energy.value,
    note: note.value,
    blockers: selectedBlockers.value.length ? selectedBlockers.value : ['None']
  })
}
</script>

<template>
  <div class="modal-backdrop">
    <form class="feedback-modal" @submit.prevent="save">
      <header>
        <p class="eyebrow">Session complete</p>
        <h2>How did it feel?</h2>
      </header>
      <fieldset>
        <legend>Flow</legend>
        <label v-for="option in ['Great flow', 'Neutral', 'Friction']" :key="option"><input v-model="flowQuality" name="flow" type="radio" :value="option"> {{ option }}</label>
      </fieldset>
      <fieldset>
        <legend>Efficiency</legend>
        <label v-for="option in ['Felt efficient', 'Felt manual', 'Felt wasteful']" :key="option"><input v-model="efficiencyFeel" name="efficiency" type="radio" :value="option"> {{ option }}</label>
      </fieldset>
      <fieldset>
        <legend>Energy</legend>
        <label v-for="option in ['High', 'OK', 'Drained']" :key="option"><input v-model="energy" name="energy" type="radio" :value="option"> {{ option }}</label>
      </fieldset>
      <fieldset>
        <legend>Blockers</legend>
        <label v-for="blocker in blockers" :key="blocker"><input v-model="selectedBlockers" type="checkbox" :value="blocker"> {{ blocker }}</label>
      </fieldset>
      <label class="stacked">Note <textarea v-model="note" rows="3" placeholder="Optional"></textarea></label>
      <p v-if="error" class="form-error">{{ error }}</p>
      <footer class="modal-actions">
        <button type="button" class="ghost" :disabled="saving" @click="emit('skip')">Skip</button>
        <button type="submit" :disabled="saving">{{ saving ? 'Saving...' : 'Save feedback' }}</button>
      </footer>
    </form>
  </div>
</template>
