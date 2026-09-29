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
const flowOptions: Array<{ value: FlowQuality, label: string }> = [
  { value: 'Great flow', label: 'Smooth focus' },
  { value: 'Neutral', label: 'Normal' },
  { value: 'Friction', label: 'Distracted' }
]
const efficiencyOptions: Array<{ value: EfficiencyFeel, label: string }> = [
  { value: 'Felt efficient', label: 'Felt efficient' },
  { value: 'Felt manual', label: 'Felt manual' },
  { value: 'Felt wasteful', label: 'Felt wasteful' }
]
const energyOptions: Array<{ value: EnergyLevel, label: string }> = [
  { value: 'High', label: 'Energized' },
  { value: 'OK', label: 'Fine' },
  { value: 'Drained', label: 'Drained' }
]
const blockerLabels: Record<string, string> = {
  'Waiting on someone': 'Waiting for someone',
  'Tool was slow or broke': 'Tool problem',
  'Unclear requirements': 'Unclear task',
  Interruptions: 'Interrupted',
  'Context switching': 'Too much switching',
  'Meetings overran': 'Meeting ran long',
  None: 'None'
}
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
        <p class="eyebrow">Work session saved</p>
        <h2>Quick check-in</h2>
      </header>
      <fieldset>
        <legend>Focus</legend>
        <label v-for="option in flowOptions" :key="option.value"><input v-model="flowQuality" name="flow" type="radio" :value="option.value"> {{ option.label }}</label>
      </fieldset>
      <fieldset>
        <legend>Efficiency</legend>
        <label v-for="option in efficiencyOptions" :key="option.value"><input v-model="efficiencyFeel" name="efficiency" type="radio" :value="option.value"> {{ option.label }}</label>
      </fieldset>
      <fieldset>
        <legend>Energy</legend>
        <label v-for="option in energyOptions" :key="option.value"><input v-model="energy" name="energy" type="radio" :value="option.value"> {{ option.label }}</label>
      </fieldset>
      <fieldset>
        <legend>Any blockers?</legend>
        <label v-for="blocker in blockers" :key="blocker"><input v-model="selectedBlockers" type="checkbox" :value="blocker"> {{ blockerLabels[blocker] }}</label>
      </fieldset>
      <label class="stacked">Add a note <textarea v-model="note" rows="3" placeholder="Optional"></textarea></label>
      <p v-if="error" class="form-error">{{ error }}</p>
      <footer class="modal-actions">
        <button type="button" class="ghost" :disabled="saving" @click="emit('skip')">Skip</button>
        <button type="submit" :disabled="saving">{{ saving ? 'Saving...' : 'Save feedback' }}</button>
      </footer>
    </form>
  </div>
</template>
