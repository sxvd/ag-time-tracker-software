<script setup lang="ts">
import type { ClosedPauseWindow, EfficiencyFeel, EnergyLevel, FlowQuality } from '~~/shared/utils/time'
import type { ApiEntry, ApiTask } from '~/types/api'

const props = defineProps<{
  entry: ApiEntry
  tasks: ApiTask[]
  blockerOptions: string[]
  saving?: boolean
  error?: string
}>()

const emit = defineEmits<{
  cancel: []
  save: [payload: {
    taskId: string
    startedAt: string
    endedAt: string
    locationLabel: string
    pauses: ClosedPauseWindow[]
    feedback: { flowQuality: FlowQuality, efficiencyFeel: EfficiencyFeel, energy: EnergyLevel, note: string }
    blockers: string[]
  }]
}>()

const taskId = ref(props.entry.taskId)
const startedAt = ref(toLocalInput(props.entry.startedAt))
const endedAt = ref(toLocalInput(props.entry.endedAt || ''))
const locationLabel = ref(props.entry.locationLabel || '')
const pauses = ref(props.entry.pauses.map((pause) => ({
  startedAt: toLocalInput(pause.startedAt),
  endedAt: toLocalInput(pause.endedAt || '')
})))
const flowQuality = ref<FlowQuality>(props.entry.feedback?.flowQuality || 'Neutral')
const efficiencyFeel = ref<EfficiencyFeel>(props.entry.feedback?.efficiencyFeel || 'Felt efficient')
const energy = ref<EnergyLevel>(props.entry.feedback?.energy || 'OK')
const note = ref(props.entry.feedback?.note || '')
const blockers = ref(props.entry.blockers.length ? [...props.entry.blockers] : ['None'])

watch(blockers, (next) => {
  if (next.length > 1 && next.includes('None')) blockers.value = next.filter((blocker) => blocker !== 'None')
})

function toLocalInput(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function addPause() {
  pauses.value.push({ startedAt: startedAt.value, endedAt: startedAt.value })
}

function save() {
  emit('save', {
    taskId: taskId.value,
    startedAt: new Date(startedAt.value).toISOString(),
    endedAt: new Date(endedAt.value).toISOString(),
    locationLabel: locationLabel.value,
    pauses: pauses.value.map((pause) => ({
      startedAt: new Date(pause.startedAt).toISOString(),
      endedAt: new Date(pause.endedAt).toISOString()
    })),
    feedback: {
      flowQuality: flowQuality.value,
      efficiencyFeel: efficiencyFeel.value,
      energy: energy.value,
      note: note.value
    },
    blockers: blockers.value.length ? blockers.value : ['None']
  })
}
</script>

<template>
  <div class="modal-backdrop">
    <form class="task-modal entry-edit-modal" role="dialog" aria-modal="true" aria-labelledby="entry-edit-title" @submit.prevent="save">
      <div class="modal-title-row">
        <h2 id="entry-edit-title">Edit time entry</h2>
        <button type="button" class="icon-close" aria-label="Close entry editor" @click="emit('cancel')">x</button>
      </div>

      <label>Task
        <select v-model="taskId" required>
          <option v-for="task in tasks" :key="task.id" :value="task.id">{{ task.title }}</option>
        </select>
      </label>
      <label>Started at <input v-model="startedAt" required type="datetime-local"></label>
      <label>Ended at <input v-model="endedAt" required type="datetime-local"></label>
      <label>Location label <input v-model="locationLabel" maxlength="100"></label>

      <fieldset>
        <legend>Pauses</legend>
        <div v-for="(pause, index) in pauses" :key="index" class="inline-fields">
          <input v-model="pause.startedAt" required type="datetime-local" :aria-label="`Pause ${index + 1} start`">
          <input v-model="pause.endedAt" required type="datetime-local" :aria-label="`Pause ${index + 1} end`">
          <button type="button" class="btn ghost sm" @click="pauses.splice(index, 1)">Remove</button>
        </div>
        <button type="button" class="btn ghost sm" @click="addPause">Add pause</button>
      </fieldset>

      <div class="inline-fields">
        <label>Flow
          <select v-model="flowQuality"><option>Great flow</option><option>Neutral</option><option>Friction</option></select>
        </label>
        <label>Efficiency
          <select v-model="efficiencyFeel"><option>Felt efficient</option><option>Felt manual</option><option>Felt wasteful</option></select>
        </label>
        <label>Energy
          <select v-model="energy"><option>High</option><option>OK</option><option>Drained</option></select>
        </label>
      </div>
      <label>Note <textarea v-model="note" maxlength="2000" rows="3"></textarea></label>
      <fieldset>
        <legend>Blockers</legend>
        <label v-for="blocker in blockerOptions" :key="blocker" class="check">
          <input v-model="blockers" type="checkbox" :value="blocker"> {{ blocker }}
        </label>
      </fieldset>
      <p v-if="error" class="form-error">{{ error }}</p>
      <div class="modal-actions">
        <button type="button" class="btn ghost" :disabled="saving" @click="emit('cancel')">Cancel</button>
        <button type="submit" class="btn primary" :disabled="saving">{{ saving ? 'Saving...' : 'Save changes' }}</button>
      </div>
    </form>
  </div>
</template>
