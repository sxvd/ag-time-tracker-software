import { computed, reactive, ref, type ComputedRef, type Ref } from 'vue'
import type { TrackerFetchOptions } from '~/composables/useTrackerApi'
import type { BreezyEvent } from '~/features/breezy/breezyRuntime'
import type { ApiEntry, ApiInvitation, ApiSharedTaskEffort, ApiState, ApiTask } from '~/types/api'

export interface TaskFormDraft {
  title: string
  description: string
  categoryId: string
  clientId: string
  projectId: string
  isShared: boolean
}

export interface TaskDependencies {
  state: Ref<ApiState | null>
  currentUserId: ComputedRef<string>
  activeEntry: ComputedRef<ApiEntry | null>
  authFetch: <T>(url: string, options?: TrackerFetchOptions) => Promise<T>
  loadState: (state: ApiState) => Promise<void> | void
  onBreezyEvent: (event: BreezyEvent) => void
}

export function useTasks(dependencies: TaskDependencies) {
  const selectedTaskId = ref('')
  const showCreateTask = ref(false)
  const showShareTaskModal = ref(false)
  const sharePickerOpen = ref(false)
  const selectedShareUserIds = ref<string[]>([])
  const inlineTaskTitle = ref('')
  const inlineCategoryId = ref('')
  const inlineTaskId = ref('')
  const taskForm = reactive<TaskFormDraft>({
    title: '',
    description: '',
    categoryId: '',
    clientId: 'cl1',
    projectId: 'p1',
    isShared: false
  })

  const activeTask = computed(() => dependencies.activeEntry.value
    ? dependencies.state.value?.tasks.find(task => task.id === dependencies.activeEntry.value?.taskId) || null
    : null)
  const latestUserTask = computed(() => {
    const tasks = dependencies.state.value?.tasks.filter(task => task.ownerId === dependencies.currentUserId.value) || []
    return tasks.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] || null
  })
  const currentTask = computed(() => activeTask.value
    || dependencies.state.value?.tasks.find(task => task.id === selectedTaskId.value)
    || latestUserTask.value)
  const currentCategoryName = computed(() => currentTask.value ? categoryName(currentTask.value.categoryId) : '')
  const hasInlineTaskTitle = computed(() => inlineTaskTitle.value.trim().length > 0)
  const shareableTask = computed(() => {
    const title = inlineTaskTitle.value.trim()
    return dependencies.state.value?.tasks.find(task => (
      task.id === inlineTaskId.value
      && task.ownerId === dependencies.currentUserId.value
      && task.title === title
      && task.categoryId === inlineCategoryId.value
    )) || null
  })
  const shareableUsers = computed(() => dependencies.state.value?.users.filter(user => user.id !== dependencies.currentUserId.value) || [])
  const pendingInvitations = computed(() => dependencies.state.value?.taskInvitations.filter(invite => (
    invite.recipientId === dependencies.currentUserId.value && invite.status === 'pending'
  )) || [])
  const sentInvitations = computed(() => dependencies.state.value?.taskInvitations.filter(invite => invite.senderId === dependencies.currentUserId.value) || [])
  const sharedTasksForCurrentUser = computed(() => pendingInvitations.value.map(invitation => ({
    invitation,
    task: dependencies.state.value?.tasks.find(task => task.id === invitation.taskId)
  })).filter((row): row is { invitation: ApiInvitation, task: ApiTask } => Boolean(row.task)))
  const teamTasksForCurrentUser = computed(() => {
    const tasks = dependencies.state.value?.tasks || []
    const summaries = new Map((dependencies.state.value?.sharedTaskEffort || []).map(summary => [summary.taskId, summary]))
    return tasks
      .filter(task => task.isShared && task.members.includes(dependencies.currentUserId.value))
      .map((task): { task: ApiTask, summary: ApiSharedTaskEffort | null } => ({
        task,
        summary: summaries.get(task.id) || null
      }))
  })

  function syncTasks(next: ApiState) {
    const runningTask = dependencies.activeEntry.value
      ? next.tasks.find(task => task.id === dependencies.activeEntry.value?.taskId)
      : null
    if (runningTask) {
      selectedTaskId.value = runningTask.id
      inlineTaskTitle.value = runningTask.title
      inlineCategoryId.value = runningTask.categoryId
      inlineTaskId.value = runningTask.id
    } else if (!inlineTaskTitle.value.trim()) {
      selectedTaskId.value = ''
      inlineTaskId.value = ''
      inlineCategoryId.value ||= next.categories[0]?.id || ''
    }
  }

  async function createTask() {
    if (!selectedShareUserIds.value.length) return
    const members = [dependencies.currentUserId.value, ...selectedShareUserIds.value]
    const next = await dependencies.authFetch<ApiState>('/api/tasks', {
      method: 'POST',
      body: {
        ...taskForm,
        isShared: true,
        members,
        requireInvitees: true
      }
    })
    await dependencies.loadState(next)
    dependencies.onBreezyEvent({ type: 'invitation-sent' })
    taskForm.title = ''
    taskForm.description = ''
    taskForm.categoryId = ''
    selectedShareUserIds.value = []
    sharePickerOpen.value = false
    showCreateTask.value = false
  }

  function handleTaskDraftChange() {
    selectedTaskId.value = ''
    inlineTaskId.value = ''
    showShareTaskModal.value = false
    sharePickerOpen.value = false
    selectedShareUserIds.value = []
  }

  function resetInlineTaskDraft() {
    selectedTaskId.value = ''
    inlineTaskTitle.value = ''
    inlineTaskId.value = ''
    inlineCategoryId.value = dependencies.state.value?.categories[0]?.id || ''
    showShareTaskModal.value = false
    sharePickerOpen.value = false
    selectedShareUserIds.value = []
  }

  function selectInlineCategory(categoryId: string) {
    inlineCategoryId.value = categoryId
    handleTaskDraftChange()
  }

  async function ensureInlineTask() {
    const title = inlineTaskTitle.value.trim()
    if (!title) return ''
    if (shareableTask.value) return shareableTask.value.id

    const categoryId = inlineCategoryId.value || dependencies.state.value?.categories[0]?.id || 'c1'
    const next = await dependencies.authFetch<ApiState>('/api/tasks', {
      method: 'POST',
      body: {
        title,
        description: '',
        categoryId,
        clientId: 'cl1',
        projectId: 'p1',
        members: [dependencies.currentUserId.value]
      }
    })
    await dependencies.loadState(next)
    const created = next.tasks.find(task => (
      task.title === title
      && task.ownerId === next.user.id
      && task.categoryId === categoryId
    )) || next.tasks[0]
    selectedTaskId.value = created.id
    inlineTaskId.value = created.id
    inlineTaskTitle.value = created.title
    inlineCategoryId.value = created.categoryId
    return created.id
  }

  async function shareCurrentTask() {
    if (!shareableTask.value || !selectedShareUserIds.value.length) return
    const next = await dependencies.authFetch<ApiState>('/api/tasks-share', {
      method: 'POST',
      body: {
        taskId: shareableTask.value.id,
        recipientIds: selectedShareUserIds.value
      }
    })
    await dependencies.loadState(next)
    selectedShareUserIds.value = []
    showShareTaskModal.value = false
    sharePickerOpen.value = false
    dependencies.onBreezyEvent({ type: 'invitation-sent' })
  }

  async function acceptInvitation(invitationId: string) {
    const next = await dependencies.authFetch<ApiState>('/api/invitations', {
      method: 'POST',
      body: { invitationId }
    })
    await dependencies.loadState(next)
    dependencies.onBreezyEvent({ type: 'invitation-accepted' })
  }

  function selectTeamTask(task: ApiTask) {
    selectedTaskId.value = task.id
    inlineTaskId.value = task.id
    inlineTaskTitle.value = task.title
    inlineCategoryId.value = task.categoryId
  }

  function taskName(taskId: string) {
    return dependencies.state.value?.tasks.find(task => task.id === taskId)?.title || 'Unknown task'
  }

  function categoryName(categoryId: string) {
    return dependencies.state.value?.categories.find(category => category.id === categoryId)?.name || 'Other'
  }

  function userName(userId: string) {
    return dependencies.state.value?.users.find(user => user.id === userId)?.displayName || 'Team member'
  }

  function shareButtonLabel() {
    if (!selectedShareUserIds.value.length) return 'Choose teammates'
    return `${selectedShareUserIds.value.length} teammate${selectedShareUserIds.value.length > 1 ? 's' : ''} selected`
  }

  function invitationForRecipient(userId: string) {
    if (!shareableTask.value) return ''
    const invite = sentInvitations.value.find(item => item.taskId === shareableTask.value?.id && item.recipientId === userId)
    return invite ? invite.status : ''
  }

  return {
    acceptInvitation,
    activeTask,
    categoryName,
    createTask,
    currentCategoryName,
    currentTask,
    ensureInlineTask,
    handleTaskDraftChange,
    hasInlineTaskTitle,
    inlineCategoryId,
    inlineTaskTitle,
    invitationForRecipient,
    resetInlineTaskDraft,
    selectInlineCategory,
    selectTeamTask,
    selectedShareUserIds,
    selectedTaskId,
    shareButtonLabel,
    shareCurrentTask,
    sharePickerOpen,
    shareableTask,
    shareableUsers,
    sharedTasksForCurrentUser,
    showCreateTask,
    showShareTaskModal,
    syncTasks,
    taskForm,
    teamTasksForCurrentUser,
    taskName,
    userName
  }
}
