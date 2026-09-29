import type { DOMWrapper, VueWrapper } from '@vue/test-utils'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiState } from '../../frontend/types/api'
import { createAppFixture, mountTrackerApp, type FixtureFetch } from './helpers/app-fixture'

vi.mock('chart.js', () => ({
  BarElement: {},
  CategoryScale: {},
  Chart: { register: vi.fn() },
  Legend: {},
  LinearScale: {},
  LineElement: {},
  PointElement: {},
  Tooltip: {}
}))

vi.mock('vue-chartjs', () => ({
  Bar: { template: '<div data-testid="bar-chart"></div>' },
  Line: { template: '<div data-testid="line-chart"></div>' }
}))

const mountedWrappers: VueWrapper[] = []

afterEach(() => {
  for (const wrapper of mountedWrappers.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
  window.sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe('task and collaboration behavior', () => {
  it('creates the edited inline task with its selected category before starting the timer', async () => {
    const fixture = createAppFixture()
    const initial = clone({
      ...fixture,
      entries: fixture.entries.filter(entry => entry.endedAt)
    })
    const createdTask = {
      ...fixture.tasks[0]!,
      id: 'task-inline',
      title: 'Inline task',
      description: '',
      categoryId: 'category-meeting',
      isShared: false,
      members: ['u1']
    }
    const afterTask = clone({ ...initial, tasks: [createdTask, ...initial.tasks] })
    const startedEntry = {
      ...fixture.entries.find(entry => entry.id === 'entry-active')!,
      id: 'entry-inline',
      taskId: createdTask.id,
      pauses: [],
      idleSeconds: 0,
      excludedIdleSeconds: 0,
      contextSwitches: 0
    }
    const afterStart = clone({ ...afterTask, entries: [startedEntry, ...afterTask.entries] })
    const fetchMock: FixtureFetch = vi.fn(async (url: string, _options?: Record<string, unknown>) => {
      if (url.endsWith('/api/bootstrap')) return initial
      if (url.endsWith('/api/tasks')) return afterTask
      if (url.endsWith('/api/timer-start')) return afterStart
      throw new Error(`Unexpected request: ${url}`)
    })
    const wrapper = await mountTasks(initial, fetchMock)

    await wrapper.get('[aria-label="Task name"]').setValue('  Inline task  ')
    await exactButton(wrapper, 'Meeting').trigger('click')
    await wrapper.get('[aria-label="Start"]').trigger('click')
    await flushPromises()

    const mutations = fetchMock.mock.calls.filter(([url]) => {
      const requestUrl = String(url)
      return !requestUrl.endsWith('/api/bootstrap') && !requestUrl.endsWith('/api/breezy-nudges/claim')
    })
    expect(mutations.map(([url]) => String(url).replace(/^.*\/api\//, '/api/'))).toEqual([
      '/api/tasks',
      '/api/timer-start'
    ])
    expect(mutations[0]?.[1]).toEqual(expect.objectContaining({
      method: 'POST',
      body: {
        title: 'Inline task',
        description: '',
        categoryId: 'category-meeting',
        clientId: 'cl1',
        projectId: 'p1',
        members: ['u1']
      }
    }))
    expect(mutations[1]?.[1]).toEqual(expect.objectContaining({
      method: 'POST',
      body: { taskId: 'task-inline' }
    }))
    expect(wrapper.get('.timer-panel h2').text()).toBe('Inline task')
    expect(wrapper.find('.status-pill').exists()).toBe(false)
  })

  it('submits the complete create-task draft and resets it after success', async () => {
    const initial = createAppFixture()
    const createdTask = {
      ...initial.tasks[0]!,
      id: 'task-created',
      title: 'Created task',
      description: 'Task details',
      categoryId: 'category-admin',
      isShared: true,
      members: ['u1', 'u2']
    }
    const afterCreate = clone({ ...initial, tasks: [createdTask, ...initial.tasks] })
    const fetchMock: FixtureFetch = vi.fn(async (url: string, _options?: Record<string, unknown>) => {
      if (url.endsWith('/api/bootstrap')) return initial
      if (url.endsWith('/api/tasks')) return afterCreate
      throw new Error(`Unexpected request: ${url}`)
    })
    const wrapper = await mountTasks(initial, fetchMock)

    await exactButton(wrapper, 'New team task').trigger('click')
    let form = wrapper.get('form.task-modal')
    const teammateTrigger = exactButton(form, 'Choose teammates')
    expect(teammateTrigger.classes()).toContain('team-picker-trigger')
    expect(teammateTrigger.attributes('aria-expanded')).toBe('false')
    await form.get('[aria-label="Task title"]').setValue('Created task')
    await form.get('[aria-label="Task description"]').setValue('Task details')
    await form.get('[aria-label="Category"]').setValue('category-admin')
    await teammateTrigger.trigger('click')
    expect(teammateTrigger.attributes('aria-expanded')).toBe('true')
    await labelContaining(form, 'Jack').get('input[type="checkbox"]').setValue(true)
    await form.trigger('submit')
    await flushPromises()

    const taskCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/tasks'))
    expect(taskCall?.[1]).toEqual(expect.objectContaining({
      method: 'POST',
      body: {
        title: 'Created task',
        description: 'Task details',
        categoryId: 'category-admin',
        clientId: 'cl1',
        projectId: 'p1',
        isShared: true,
        members: ['u1', 'u2'],
        requireInvitees: true
      }
    }))
    expect(wrapper.get('.breezy-copy h2').text()).toBe('Invitation sent')
    expect(wrapper.find('.breezy-message').exists()).toBe(false)

    await exactButton(wrapper, 'New team task').trigger('click')
    form = wrapper.get('form.task-modal')
    expect(form.get<HTMLInputElement>('[aria-label="Task title"]').element.value).toBe('')
    expect(form.get<HTMLTextAreaElement>('[aria-label="Task description"]').element.value).toBe('')
    expect(form.get<HTMLSelectElement>('[aria-label="Category"]').element.value).toBe('')
    expect(form.find('[aria-label="Estimate minutes"]').exists()).toBe(false)
    expect(exactButton(form, 'Choose teammates').exists()).toBe(true)
  })

  it('allows only the owner to open sharing and sends the selected recipient IDs', async () => {
    const initial = createAppFixture()
    const afterShare = clone({
      ...initial,
      taskInvitations: [
        ...initial.taskInvitations,
        {
          id: 'invite-sent',
          taskId: 'task-active',
          senderId: 'u1',
          recipientId: 'u3',
          status: 'pending' as const,
          createdAt: '2026-08-28T02:00:00.000Z'
        }
      ]
    })
    const fetchMock: FixtureFetch = vi.fn(async (url: string, _options?: Record<string, unknown>) => {
      if (url.endsWith('/api/bootstrap')) return initial
      if (url.endsWith('/api/tasks-share')) return afterShare
      throw new Error(`Unexpected request: ${url}`)
    })
    const ownerWrapper = await mountTasks(initial, fetchMock)

    await exactButton(ownerWrapper, 'Share task').trigger('click')
    const dialog = ownerWrapper.get('[role="dialog"]')
    await labelContaining(dialog, 'Jay').get('input[type="checkbox"]').setValue(true)
    await exactButton(dialog, 'Send invite to 1').trigger('click')
    await flushPromises()

    const shareCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/tasks-share'))
    expect(shareCall?.[1]).toEqual(expect.objectContaining({
      method: 'POST',
      body: { taskId: 'task-active', recipientIds: ['u3'] }
    }))
    expect(ownerWrapper.get('.breezy-copy h2').text()).toBe('Invitation sent')
    expect(ownerWrapper.find('.breezy-message').exists()).toBe(false)

    const nonOwner = clone(initial)
    nonOwner.tasks = nonOwner.tasks.map(task => task.id === 'task-active' ? { ...task, ownerId: 'u2' } : task)
    const nonOwnerFetch: FixtureFetch = vi.fn(async () => nonOwner)
    const nonOwnerWrapper = await mountTasks(nonOwner, nonOwnerFetch)

    expect(exactButtons(nonOwnerWrapper, 'Share task')).toHaveLength(0)
  })

  it('requires a teammate before creating a new team task', async () => {
    const initial = createAppFixture()
    const createdTask = {
      ...initial.tasks[0]!,
      id: 'task-private',
      title: 'Private task',
      isShared: false,
      members: ['u1']
    }
    const afterCreate = clone({ ...initial, tasks: [createdTask, ...initial.tasks] })
    const fetchMock: FixtureFetch = vi.fn(async (url: string) => {
      if (url.endsWith('/api/bootstrap')) return initial
      if (url.endsWith('/api/tasks')) return afterCreate
      throw new Error(`Unexpected request: ${url}`)
    })
    const wrapper = await mountTasks(initial, fetchMock)

    await exactButton(wrapper, 'New team task').trigger('click')
    const form = wrapper.get('form.task-modal')
    await form.get('[aria-label="Task title"]').setValue('Private task')
    expect(exactButton(form, 'Add team task').attributes('disabled')).toBeDefined()
    await form.trigger('submit')
    await flushPromises()

    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/tasks'))).toBe(false)
    expect(wrapper.text()).not.toContain('Invitation sent')
  })

  it('shows pending invitation status and accepts an incoming invitation', async () => {
    const fixture = createAppFixture()
    const initial = clone({
      ...fixture,
      taskInvitations: [
        ...fixture.taskInvitations,
        {
          id: 'invite-owner-pending',
          taskId: 'task-active',
          senderId: 'u1',
          recipientId: 'u2',
          status: 'pending' as const,
          createdAt: '2026-08-28T02:05:00.000Z'
        }
      ]
    })
    const accepted = clone({
      ...initial,
      entries: initial.entries.filter(entry => entry.endedAt),
      taskInvitations: initial.taskInvitations.map(invite => invite.id === 'invite-1'
        ? { ...invite, status: 'accepted' as const, respondedAt: '2026-08-28T02:10:00.000Z' }
        : invite),
      tasks: initial.tasks.map(task => task.id === 'task-invited'
        ? { ...task, members: ['u2', 'u1'] }
        : task),
      sharedTaskEffort: [
        ...initial.sharedTaskEffort,
        {
          taskId: 'task-invited',
          taskTitle: 'Sensor QA handoff',
          myDurationSeconds: 0,
          members: [
            { userId: 'u2', displayName: 'Jack', role: 'owner' as const },
            { userId: 'u1', displayName: 'Mog', role: 'member' as const }
          ]
        }
      ]
    })
    const fetchMock: FixtureFetch = vi.fn(async (url: string, _options?: Record<string, unknown>) => {
      if (url.endsWith('/api/bootstrap')) return initial
      if (url.endsWith('/api/invitations')) return accepted
      throw new Error(`Unexpected request: ${url}`)
    })
    const wrapper = await mountTasks(initial, fetchMock)

    await exactButton(wrapper, 'New team task').trigger('click')
    expect(wrapper.get('form.task-modal').text()).not.toContain('Jack - pending')
    await wrapper.get('[aria-label="Close create team task"]').trigger('click')

    await exactButton(wrapper, 'Share task').trigger('click')
    const shareDialog = wrapper.get('[role="dialog"]')
    const jackCheckbox = labelContaining(shareDialog, 'Jack').get<HTMLInputElement>('input[type="checkbox"]')
    expect(jackCheckbox.element.disabled).toBe(true)
    expect(labelContaining(shareDialog, 'Jack').text()).toContain('pending')
    await wrapper.get('[aria-label="Close share task"]').trigger('click')

    const inviteCard = wrapper.get('[aria-label="Task invitation"]')
    expect(inviteCard.text()).toContain('Task invitation')
    expect(inviteCard.text()).toContain('Jack invited you to join')

    await exactButton(wrapper, 'Join').trigger('click')
    await flushPromises()

    const acceptCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/invitations'))
    expect(acceptCall?.[1]).toEqual(expect.objectContaining({
      method: 'POST',
      body: { invitationId: 'invite-1' }
    }))
    expect(wrapper.get<HTMLInputElement>('[aria-label="Task name"]').element.value).toBe('Production readiness review')
    expect(wrapper.text()).not.toContain('Task invitation')
    expect(wrapper.get('.breezy-copy h2').text()).toBe('Shared task joined')
    expect(wrapper.find('.breezy-message').exists()).toBe(false)

    await exactButton(wrapper, 'Team').trigger('click')
    expect(wrapper.get('table.entry-table-team').text()).toContain('My time spent')
    expect(wrapper.text()).toContain('Sensor QA handoff')
    expect(wrapper.text()).toContain('0m')

    const joinedTeamTask = wrapper.findAll('tr')
      .find(row => normalize(row.text()).includes('Sensor QA handoff'))
    if (!joinedTeamTask) throw new Error('Joined team task card not found')
    const trackTaskButton = exactButton(joinedTeamTask, 'Track task')
    expect(trackTaskButton.classes()).toContain('team-task-action')
    expect(trackTaskButton.classes()).not.toContain('ghost')
    await trackTaskButton.trigger('click')
    expect(wrapper.get<HTMLInputElement>('[aria-label="Task name"]').element.value).toBe('Sensor QA handoff')
    expect(exactButton(joinedTeamTask, 'Cancel').exists()).toBe(true)

    await exactButton(joinedTeamTask, 'Cancel').trigger('click')
    expect(wrapper.get<HTMLInputElement>('[aria-label="Task name"]').element.value).toBe('')
  })
})

async function mountTasks(state: ApiState, fetchMock: FixtureFetch) {
  const result = await mountTrackerApp({ state, fetchMock })
  mountedWrappers.push(result.wrapper)
  return result.wrapper
}

interface FindableWrapper {
  findAll(selector: string): DOMWrapper<Element>[]
}

function exactButtons(wrapper: FindableWrapper, label: string) {
  return wrapper.findAll('button').filter(candidate => normalize(candidate.text()) === label)
}

function exactButton(wrapper: FindableWrapper, label: string) {
  const match = exactButtons(wrapper, label)[0]
  if (!match) throw new Error(`Button not found: ${label}`)
  return match
}

function labelContaining(wrapper: FindableWrapper, text: string) {
  const match = wrapper.findAll('label').find(candidate => normalize(candidate.text()).includes(text))
  if (!match) throw new Error(`Label not found: ${text}`)
  return match
}

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
