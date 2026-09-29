import type { DOMWrapper, VueWrapper } from '@vue/test-utils'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FeedbackModal from '../../frontend/features/feedback/FeedbackModal.vue'
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

describe('end-of-session feedback behavior', () => {
  it('opens feedback before stopping and sends structured feedback with exclusive blockers', async () => {
    const initial = createAppFixture()
    const stopped = stopActiveEntry(initial, {
      feedback: {
        flowQuality: 'Great flow',
        efficiencyFeel: 'Felt manual',
        energy: 'High',
        note: 'Useful pairing session.'
      },
      blockers: ['Waiting on someone']
    })
    const fetchMock: FixtureFetch = vi.fn(async (url: string) => {
      if (url.endsWith('/api/bootstrap')) return initial
      if (url.endsWith('/api/timer-stop')) return stopped
      throw new Error(`Unexpected request: ${url}`)
    })
    const wrapper = await mountEntries(initial, fetchMock)

    await exactButton(wrapper, 'Stop').trigger('click')

    expect(wrapper.get('.feedback-modal').text()).toContain('Quick check-in')
    expect(wrapper.get('.feedback-modal').text()).toContain('Smooth focus')
    expect(wrapper.get('.feedback-modal').text()).toContain('Tool problem')
    expect(mutationCalls(fetchMock)).toHaveLength(0)

    await wrapper.get('input[name="flow"][value="Great flow"]').setValue(true)
    await wrapper.get('input[name="efficiency"][value="Felt manual"]').setValue(true)
    await wrapper.get('input[name="energy"][value="High"]').setValue(true)
    await wrapper.get('input[type="checkbox"][value="Waiting on someone"]').setValue(true)
    await wrapper.get('.feedback-modal textarea').setValue('Useful pairing session.')
    await wrapper.get('form.feedback-modal').trigger('submit')
    await flushPromises()

    expect(requestOptions(fetchMock, '/api/timer-stop')).toEqual(expect.objectContaining({
      method: 'POST',
      body: {
        entryId: 'entry-active',
        feedback: {
          flowQuality: 'Great flow',
          efficiencyFeel: 'Felt manual',
          energy: 'High',
          note: 'Useful pairing session.',
          blockers: ['Waiting on someone']
        },
        blockers: ['Waiting on someone']
      }
    }))
    expect(wrapper.find('.feedback-modal').exists()).toBe(false)
    expect(wrapper.text()).toContain('Great flow. You found a strong rhythm today.')
  })

  it('skips optional feedback only after confirmation and still stops with None', async () => {
    const initial = createAppFixture()
    const stopped = stopActiveEntry(initial)
    const fetchMock: FixtureFetch = vi.fn(async (url: string) => {
      if (url.endsWith('/api/bootstrap')) return initial
      if (url.endsWith('/api/timer-stop')) return stopped
      throw new Error(`Unexpected request: ${url}`)
    })
    const wrapper = await mountEntries(initial, fetchMock)

    await exactButton(wrapper, 'Stop').trigger('click')
    expect(mutationCalls(fetchMock)).toHaveLength(0)
    await exactButton(wrapper, 'Skip').trigger('click')
    await flushPromises()

    expect(requestOptions(fetchMock, '/api/timer-stop')).toEqual(expect.objectContaining({
      method: 'POST',
      body: {
        entryId: 'entry-active',
        feedback: undefined,
        blockers: ['None']
      }
    }))
    expect(wrapper.find('.feedback-modal').exists()).toBe(false)
    expect(wrapper.text()).toContain('Your session is saved. Nice work.')
  })

  it('renders a safe feedback error without exposing server details', async () => {
    const initial = createAppFixture()
    const fetchMock: FixtureFetch = vi.fn(async (url: string) => {
      if (url.endsWith('/api/bootstrap')) return initial
      if (url.endsWith('/api/timer-stop')) throw new Error('database connection password leaked')
      throw new Error(`Unexpected request: ${url}`)
    })
    const wrapper = await mountEntries(initial, fetchMock)

    await exactButton(wrapper, 'Stop').trigger('click')
    await exactButton(wrapper, 'Save feedback').trigger('click')
    await flushPromises()

    expect(wrapper.get('.feedback-modal .form-error').text()).toBe(
      'Could not save this session. The timer is out of sync with the server, likely after a restart. Refresh and start a new timer.'
    )
    expect(wrapper.text()).not.toContain('database connection password leaked')
  })

  it('starts every remounted feedback draft from the documented defaults', async () => {
    const first = mountFeedback()
    await first.get('input[name="flow"][value="Friction"]').setValue(true)
    await first.get('input[type="checkbox"][value="Interruptions"]').setValue(true)
    await first.get('textarea').setValue('Old draft')
    first.unmount()

    const second = mountFeedback()
    await second.get('form').trigger('submit')

    expect(second.emitted('save')).toEqual([[
      {
        flowQuality: 'Neutral',
        efficiencyFeel: 'Felt efficient',
        energy: 'OK',
        note: '',
        blockers: ['None']
      }
    ]])
  })
})

describe('manual entry and entry editing behavior', () => {
  it('sends manual dates with the default blocker and fixed retroactive feedback', async () => {
    const initial = createAppFixture()
    const afterManual = clone(initial)
    const fetchMock: FixtureFetch = vi.fn(async (url: string) => {
      if (url.endsWith('/api/bootstrap')) return initial
      if (url.endsWith('/api/manual-entry')) return afterManual
      throw new Error(`Unexpected request: ${url}`)
    })
    const wrapper = await mountEntries(initial, fetchMock)

    await exactButton(wrapper, 'Manual entry').trigger('click')
    const form = wrapper.get('form.task-modal')
    await form.get('[aria-label="Manual task"]').setValue('task-invited')
    await form.get('[aria-label="Manual start"]').setValue('2026-08-26T09:15')
    await form.get('[aria-label="Manual end"]').setValue('2026-08-26T10:45')
    await form.trigger('submit')
    await flushPromises()

    expect(requestOptions(fetchMock, '/api/manual-entry')).toEqual(expect.objectContaining({
      method: 'POST',
      body: {
        taskId: 'task-invited',
        startedAt: '2026-08-26T09:15',
        endedAt: '2026-08-26T10:45',
        blockers: ['None'],
        feedback: {
          flowQuality: 'Neutral',
          efficiencyFeel: 'Felt manual',
          energy: 'OK',
          note: 'Retroactive entry'
        }
      }
    }))
    expect(wrapper.find('[aria-label="Manual task"]').exists()).toBe(false)
    expect(wrapper.get('.breezy-copy h2').text()).toBe('Manual entry saved')
    expect(wrapper.find('.breezy-message').exists()).toBe(false)
  })

  it('edits only an owned completed entry without sending server-authoritative activity totals', async () => {
    const initial = createAppFixture()
    const afterEdit = clone(initial)
    const fetchMock: FixtureFetch = vi.fn(async (url: string) => {
      if (url.endsWith('/api/bootstrap')) return initial
      if (url.endsWith('/api/entries/entry-completed')) return afterEdit
      throw new Error(`Unexpected request: ${url}`)
    })
    const wrapper = await mountEntries(initial, fetchMock)

    const editButtons = wrapper.findAll('button[aria-label^="Edit "]')
    expect(editButtons).toHaveLength(1)
    expect(editButtons[0]?.attributes('aria-label')).toBe('Edit Production readiness review entry')
    await editButtons[0]!.trigger('click')

    const form = wrapper.get('form.entry-edit-modal')
    await labelStartingWith(form, 'Task').get('select').setValue('task-invited')
    expect(form.findAll('label').map(label => normalize(label.text()))).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^Idle seconds/), expect.stringMatching(/^Context switches/)])
    )
    await labelStartingWith(form, 'Location label').get('input').setValue('AirGradient office')
    await exactButton(form, 'Add pause').trigger('click')
    await form.get('[aria-label="Pause 1 start"]').setValue(localInput('2026-08-24T03:30:00.000Z'))
    await form.get('[aria-label="Pause 1 end"]').setValue(localInput('2026-08-24T03:40:00.000Z'))
    await labelStartingWith(form, 'Flow').get('select').setValue('Friction')
    await labelStartingWith(form, 'Efficiency').get('select').setValue('Felt wasteful')
    await labelStartingWith(form, 'Energy').get('select').setValue('Drained')
    await labelStartingWith(form, 'Note').get('textarea').setValue('Adjusted after review.')
    await form.get('input[type="checkbox"][value="Interruptions"]').setValue(true)
    await form.trigger('submit')
    await flushPromises()

    expect(requestOptions(fetchMock, '/api/entries/entry-completed')).toEqual(expect.objectContaining({
      method: 'PATCH',
      body: {
        taskId: 'task-invited',
        startedAt: '2026-08-24T03:00:00.000Z',
        endedAt: '2026-08-24T04:15:00.000Z',
        locationLabel: 'AirGradient office',
        pauses: [{
          startedAt: '2026-08-24T03:30:00.000Z',
          endedAt: '2026-08-24T03:40:00.000Z'
        }],
        feedback: {
          flowQuality: 'Friction',
          efficiencyFeel: 'Felt wasteful',
          energy: 'Drained',
          note: 'Adjusted after review.'
        },
        blockers: ['Interruptions']
      }
    }))
    expect(wrapper.find('form.entry-edit-modal').exists()).toBe(false)
    expect(wrapper.get('.breezy-copy h2').text()).toBe('Entry updated')
    expect(wrapper.find('.breezy-message').exists()).toBe(false)
  })

  it('keeps the editor open with a safe API validation message', async () => {
    const initial = createAppFixture()
    const fetchMock: FixtureFetch = vi.fn(async (url: string) => {
      if (url.endsWith('/api/bootstrap')) return initial
      if (url.endsWith('/api/entries/entry-completed')) {
        throw { data: { statusMessage: 'Entry overlaps another entry.', message: 'internal query details' } }
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    const wrapper = await mountEntries(initial, fetchMock)

    await wrapper.get('button[aria-label="Edit Production readiness review entry"]').trigger('click')
    await wrapper.get('form.entry-edit-modal').trigger('submit')
    await flushPromises()

    expect(wrapper.get('form.entry-edit-modal .form-error').text()).toBe('Entry overlaps another entry.')
    expect(wrapper.text()).not.toContain('internal query details')
  })
})

async function mountEntries(state: ApiState, fetchMock: FixtureFetch) {
  const result = await mountTrackerApp({ state, fetchMock })
  mountedWrappers.push(result.wrapper)
  return result.wrapper
}

function mountFeedback() {
  const wrapper = mount(FeedbackModal, { attachTo: document.body })
  mountedWrappers.push(wrapper)
  return wrapper
}

function stopActiveEntry(state: ApiState, values: {
  feedback?: ApiState['entries'][number]['feedback']
  blockers?: string[]
} = {}) {
  const next = clone(state)
  next.entries = next.entries.map(entry => entry.id === 'entry-active'
    ? {
        ...entry,
        endedAt: '2026-08-25T04:00:00.000Z',
        durationSeconds: 3_300,
        feedback: values.feedback,
        blockers: values.blockers || ['None']
      }
    : entry)
  return next
}

function mutationCalls(fetchMock: FixtureFetch) {
  return fetchMock.mock.calls.filter(([url]) => {
    const requestUrl = String(url)
    return !requestUrl.endsWith('/api/bootstrap') && !requestUrl.endsWith('/api/breezy-nudges/claim')
  })
}

function requestOptions(fetchMock: FixtureFetch, path: string) {
  return fetchMock.mock.calls.find(([url]) => String(url).endsWith(path))?.[1]
}

interface FindableWrapper {
  findAll(selector: string): DOMWrapper<Element>[]
}

function exactButton(wrapper: FindableWrapper, label: string) {
  const match = wrapper.findAll('button').find(candidate => normalize(candidate.text()) === label)
  if (!match) throw new Error(`Button not found: ${label}`)
  return match
}

function labelStartingWith(wrapper: FindableWrapper, text: string) {
  const match = wrapper.findAll('label').find(candidate => normalize(candidate.text()).startsWith(text))
  if (!match) throw new Error(`Label not found: ${text}`)
  return match
}

function localInput(iso: string) {
  const date = new Date(iso)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
