import { reactive, ref, type ComputedRef, type Ref } from 'vue'
import type { ClosedPauseWindow, EfficiencyFeel, EnergyLevel, FlowQuality } from '~~/shared/utils/time'
import type { TrackerFetchOptions } from '~/composables/useTrackerApi'
import type { BreezyEvent } from '~/features/breezy/breezyRuntime'
import type { ApiEntry, ApiState } from '~/types/api'

export interface FeedbackPayload {
  flowQuality: FlowQuality
  efficiencyFeel: EfficiencyFeel
  energy: EnergyLevel
  note: string
  blockers: string[]
}

export interface ManualEntryDraft {
  taskId: string
  startedAt: string
  endedAt: string
  blockers: string[]
}

export interface EntryEditPayload {
  taskId: string
  startedAt: string
  endedAt: string
  locationLabel: string
  pauses: ClosedPauseWindow[]
  feedback: {
    flowQuality: FlowQuality
    efficiencyFeel: EfficiencyFeel
    energy: EnergyLevel
    note: string
  }
  blockers: string[]
}

export interface EntryDependencies {
  activeEntry: ComputedRef<ApiEntry | null>
  currentUserId: ComputedRef<string>
  selectedTaskId: Ref<string>
  authFetch: <T>(url: string, options?: TrackerFetchOptions) => Promise<T>
  loadState: (state?: ApiState) => Promise<void>
  waitForContextSwitches: () => Promise<void>
  resetInlineTaskDraft: () => void
  onBreezyEvent: (event: BreezyEvent) => void
}

export function useEntries(dependencies: EntryDependencies) {
  const showFeedback = ref(false)
  const lastStoppedEntry = ref<string | null>(null)
  const feedbackError = ref('')
  const isSavingFeedback = ref(false)
  const showManualEntry = ref(false)
  const editingEntry = ref<ApiEntry | null>(null)
  const editEntryError = ref('')
  const isSavingEntryEdit = ref(false)
  const manualForm = reactive<ManualEntryDraft>({
    taskId: '',
    startedAt: '',
    endedAt: '',
    blockers: ['None']
  })

  function syncEntries() {
    manualForm.taskId ||= dependencies.selectedTaskId.value
  }

  function stopTimer() {
    lastStoppedEntry.value = dependencies.activeEntry.value?.id || null
    feedbackError.value = ''
    showFeedback.value = true
  }

  async function saveFeedback(payload?: FeedbackPayload) {
    if (isSavingFeedback.value) return
    if (!lastStoppedEntry.value) {
      feedbackError.value = 'No active session is available to save. Refresh the page and start a new timer.'
      return
    }

    feedbackError.value = ''
    isSavingFeedback.value = true
    try {
      await dependencies.waitForContextSwitches()
      const next = await dependencies.authFetch<ApiState>('/api/timer-stop', {
        method: 'POST',
        body: {
          entryId: lastStoppedEntry.value,
          feedback: payload,
          blockers: payload?.blockers || ['None']
        }
      })
      showFeedback.value = false
      lastStoppedEntry.value = null
      await dependencies.loadState(next)
      dependencies.resetInlineTaskDraft()
      dependencies.onBreezyEvent({ type: 'session-saved', greatFlow: payload?.flowQuality === 'Great flow' })
    } catch {
      await dependencies.loadState().catch(() => null)
      feedbackError.value = 'Could not save this session. The timer is out of sync with the server, likely after a restart. Refresh and start a new timer.'
    } finally {
      isSavingFeedback.value = false
    }
  }

  async function addManualEntry() {
    const next = await dependencies.authFetch<ApiState>('/api/manual-entry', {
      method: 'POST',
      body: {
        ...manualForm,
        feedback: {
          flowQuality: 'Neutral',
          efficiencyFeel: 'Felt manual',
          energy: 'OK',
          note: 'Retroactive entry'
        }
      }
    })
    await dependencies.loadState(next)
    dependencies.onBreezyEvent({ type: 'manual-entry-saved' })
    showManualEntry.value = false
  }

  function openEntryEditor(entry: ApiEntry) {
    if (entry.userId !== dependencies.currentUserId.value || !entry.endedAt) return
    editEntryError.value = ''
    editingEntry.value = entry
  }

  async function saveEntryEdit(payload: EntryEditPayload) {
    if (!editingEntry.value || isSavingEntryEdit.value) return
    editEntryError.value = ''
    isSavingEntryEdit.value = true
    try {
      const next = await dependencies.authFetch<ApiState>(`/api/entries/${editingEntry.value.id}`, {
        method: 'PATCH',
        body: payload
      })
      await dependencies.loadState(next)
      editingEntry.value = null
      dependencies.onBreezyEvent({ type: 'entry-updated' })
    } catch (error: any) {
      editEntryError.value = error?.data?.statusMessage || error?.data?.message || 'Could not update this entry.'
    } finally {
      isSavingEntryEdit.value = false
    }
  }

  return {
    addManualEntry,
    editingEntry,
    editEntryError,
    feedbackError,
    isSavingEntryEdit,
    isSavingFeedback,
    manualForm,
    openEntryEditor,
    saveEntryEdit,
    saveFeedback,
    showFeedback,
    showManualEntry,
    stopTimer,
    syncEntries
  }
}
