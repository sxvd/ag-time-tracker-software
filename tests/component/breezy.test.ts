import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { useNuxtApp } from '#app'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BreezyCompanion from '../../frontend/features/breezy/BreezyCompanion.vue'
import BreezyJourney from '../../frontend/features/breezy/BreezyJourney.vue'
import BreezyNudgeToast from '../../frontend/features/breezy/BreezyNudgeToast.vue'
import type { BreezyPresentation } from '../../frontend/features/breezy/breezyRuntime'
import { mascotPools } from '../../frontend/features/breezy/mascotCatalog'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { createAppFixture, mountTrackerApp } from './helpers/app-fixture'

const wrappers: VueWrapper[] = []

beforeEach(() => {
  useNuxtApp().$config.app.baseURL = '/tracker/'
})

afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('BreezyCompanion', () => {
  it('renders the resolved label and message without exposing a raw mood label', async () => {
    const wrapper = track(mount(BreezyCompanion, {
      props: { presentation: presentation(), muted: false }
    }))

    expect(wrapper.get('section.breezy-panel').attributes('aria-live')).toBe('polite')
    expect(wrapper.get('.breezy-orbit').attributes('data-mood')).toBe('cheering')
    expect(wrapper.get('.breezy-orbit').classes()).toContain('wiggle')
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toBe('Great flow')
    expect(wrapper.get('h2').text()).toBe('Great flow')
    expect(wrapper.get('.breezy-message').text()).toBe('Great flow. You found a strong rhythm today.')
    expect(wrapper.text()).not.toContain('Breezy: cheering')
    expect(wrapper.get('img').attributes('src')).toMatch(/^\/tracker\/mascots\/mascot-[a-z0-9-]+\.png$/)
    expect(mascotPools.celebrate).toContain(withoutTrackerBase(wrapper.get('img').attributes('src')))
  })

  it('changes to a different mascot from the resolved pool every two minutes', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const wrapper = track(mount(BreezyCompanion, {
      props: { presentation: presentation({ imagePool: 'focus' }), muted: false }
    }))
    await wrapper.vm.$nextTick()
    const firstMascot = wrapper.get('img').attributes('src')

    await vi.advanceTimersByTimeAsync(119_999)
    expect(wrapper.get('img').attributes('src')).toBe(firstMascot)

    await vi.advanceTimersByTimeAsync(1)
    expect(wrapper.get('img').attributes('src')).not.toBe(firstMascot)
    expect(mascotPools.focus).toContain(withoutTrackerBase(wrapper.get('img').attributes('src')))
  })

  it('switches image pools immediately when the presentation changes', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const wrapper = track(mount(BreezyCompanion, {
      props: { presentation: presentation({ imagePool: 'focus' }), muted: false }
    }))

    expect(mascotPools.focus).toContain(withoutTrackerBase(wrapper.get('img').attributes('src')))
    await wrapper.setProps({ presentation: presentation({ mood: 'sipping-water', label: 'Taking a break', imagePool: 'break' }) })
    expect(mascotPools.break).toContain(withoutTrackerBase(wrapper.get('img').attributes('src')))
  })

  it('avoids repeating the current mascot when switching between overlapping pools', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.4)
    const wrapper = track(mount(BreezyCompanion, {
      props: { presentation: presentation({ imagePool: 'ready' }), muted: false }
    }))
    const readyMascot = wrapper.get('img').attributes('src')

    expect(readyMascot).toMatch(/\/mascots\/mascot-hello\.png$/)
    await wrapper.setProps({ presentation: presentation({ imagePool: 'celebrate' }) })
    expect(wrapper.get('img').attributes('src')).not.toBe(readyMascot)
  })

  it('stops the mascot rotation timer when the companion unmounts', async () => {
    vi.useFakeTimers()
    const wrapper = mount(BreezyCompanion, {
      props: { presentation: presentation(), muted: false }
    })

    expect(vi.getTimerCount()).toBe(1)
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps a muted presentation silent', async () => {
    vi.useFakeTimers()
    const wrapper = track(mount(BreezyCompanion, {
      props: {
        presentation: presentation({ label: 'Breezy is muted', message: '', imagePool: 'quiet', announce: false, celebrate: false }),
        muted: true
      }
    }))

    expect(wrapper.get('section').attributes('aria-live')).toBe('off')
    expect(wrapper.get('h2').text()).toBe('Breezy is muted')
    expect(wrapper.find('.breezy-message').exists()).toBe(false)
    expect(mascotPools.quiet).toContain(withoutTrackerBase(wrapper.get('img').attributes('src')))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('starts and stops mascot rotation when mute changes', async () => {
    vi.useFakeTimers()
    const wrapper = track(mount(BreezyCompanion, {
      props: {
        presentation: presentation({ label: 'Breezy is muted', message: '', imagePool: 'quiet', announce: false, celebrate: false }),
        muted: true
      }
    }))

    expect(vi.getTimerCount()).toBe(0)
    await wrapper.setProps({ muted: false })
    expect(vi.getTimerCount()).toBe(1)
    await wrapper.setProps({ muted: true })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('restarts celebration motion only when the runtime motion key changes', async () => {
    const wrapper = track(mount(BreezyCompanion, {
      props: { presentation: presentation(), motionKey: 0, muted: false }
    }))
    const firstOrbit = wrapper.get('.breezy-orbit').element

    await wrapper.setProps({ motionKey: 1 })

    expect(wrapper.get('.breezy-orbit').element).not.toBe(firstOrbit)
    expect(wrapper.get('.breezy-orbit').classes()).toContain('wiggle')
  })
})

describe('BreezyNudgeToast', () => {
  it('renders a newly claimed nudge as a polite non-modal status with a keyboard button', () => {
    const wrapper = track(mount(BreezyNudgeToast, {
      props: { nudge: nudge(), restored: false }
    }))

    expect(wrapper.get('aside').attributes()).toMatchObject({ role: 'status', 'aria-live': 'polite' })
    expect(wrapper.get('strong').text()).toBe('Focus reminder')
    expect(wrapper.get('p').text()).toBe('A server-provided reminder.')
    expect(wrapper.get('button').attributes('aria-label')).toBe('Dismiss Breezy reminder')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('does not re-announce a restored nudge and emits dismiss only from the explicit button', async () => {
    const wrapper = track(mount(BreezyNudgeToast, {
      props: { nudge: nudge({ type: 'hydration' }), restored: true }
    }))

    expect(wrapper.get('aside').attributes('aria-live')).toBe('off')
    expect(wrapper.get('strong').text()).toBe('Hydration reminder')
    expect(wrapper.emitted('dismiss')).toBeUndefined()
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })

  it('shows a safe dismissal failure and disables duplicate dismissal while saving', () => {
    const wrapper = track(mount(BreezyNudgeToast, {
      props: {
        nudge: nudge(),
        dismissing: true,
        error: 'Could not dismiss this reminder. Please try again.'
      }
    }))

    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[role="alert"]').text()).toBe('Could not dismiss this reminder. Please try again.')
  })

  it('uses an understandable ventilation label', () => {
    const wrapper = track(mount(BreezyNudgeToast, {
      props: { nudge: nudge({ type: 'ventilation' }) }
    }))
    expect(wrapper.get('strong').text()).toBe('Fresh-air reminder')
  })

  it('restores without claiming, hides behind a blocking form, and acknowledges only on Dismiss', async () => {
    const restored = nudge({ id: 'restored-1' })
    const state = createAppFixture({ breezyNudges: [restored] })
    const fetchMock = vi.fn(async (url: string, options: Record<string, unknown> = {}) => {
      if (url.endsWith('/api/bootstrap')) return state
      if (url.endsWith('/api/breezy-nudges/restored-1') && options.method === 'PATCH') {
        return { nudge: { ...restored, acknowledgedAt: '2026-09-04T01:00:00.000Z' } }
      }
      throw new Error(`Unexpected request: ${options.method || 'GET'} ${url}`)
    })
    const mounted = await mountTrackerApp({ state, fetchMock })
    const wrapper = track(mounted.wrapper)

    expect(wrapper.get('.breezy-toast').attributes('aria-live')).toBe('off')
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/breezy-nudges/claim'))).toBe(false)

    await wrapper.findAll('button').find(button => button.text() === 'New team task')!.trigger('click')
    expect(wrapper.find('.breezy-toast').exists()).toBe(false)
    await wrapper.get('[aria-label="Close create team task"]').trigger('click')
    expect(wrapper.find('.breezy-toast').exists()).toBe(true)

    await wrapper.get('[aria-label="Dismiss Breezy reminder"]').trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/breezy-nudges\/restored-1$/),
      expect.objectContaining({ method: 'PATCH' })
    )
    expect(wrapper.find('.breezy-toast').exists()).toBe(false)
  })

  it('keeps a restored nudge hidden while paused and shows it without re-announcing after resume', async () => {
    const restored = nudge({ id: 'paused-restored' })
    const base = createAppFixture({ breezyNudges: [restored] })
    const paused = createAppFixture({
      breezyNudges: [restored],
      entries: base.entries.map(entry => entry.id === 'entry-active'
        ? { ...entry, pauses: [...entry.pauses, { startedAt: '2026-09-04T00:10:00.000Z', endedAt: null, durationSeconds: null }] }
        : entry)
    })
    const resumed = createAppFixture({ breezyNudges: [restored] })
    const fetchMock = vi.fn(async (url: string, options: Record<string, unknown> = {}) => {
      if (url.endsWith('/api/bootstrap')) return paused
      if (url.endsWith('/api/timer-resume') && options.method === 'POST') return resumed
      throw new Error(`Unexpected request: ${options.method || 'GET'} ${url}`)
    })
    const mounted = await mountTrackerApp({ state: paused, fetchMock })
    const wrapper = track(mounted.wrapper)

    expect(wrapper.find('.breezy-toast').exists()).toBe(false)
    await wrapper.get('[aria-label="Resume"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('.breezy-toast').attributes('aria-live')).toBe('off')
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/breezy-nudges/claim'))).toBe(false)
  })
})

function presentation(overrides: Partial<BreezyPresentation> = {}): BreezyPresentation {
  return {
    mood: 'cheering',
    label: 'Great flow',
    message: 'Great flow. You found a strong rhythm today.',
    imagePool: 'celebrate',
    announce: true,
    celebrate: true,
    dismissibleNudgeId: null,
    ...overrides
  }
}

function withoutTrackerBase(path: string | undefined) {
  return (path || '').replace(/^\/tracker/, '')
}

function nudge(overrides: Partial<import('../../frontend/types/api').ApiBreezyNudge> = {}): import('../../frontend/types/api').ApiBreezyNudge {
  return {
    id: 'nudge-1',
    relatedEntryId: 'entry-1',
    type: 'long-focus',
    message: 'A server-provided reminder.',
    shownAt: '2026-09-04T00:45:00.000Z',
    acknowledgedAt: null,
    ...overrides
  }
}

describe('BreezyJourney', () => {
  it('keeps the calm empty Journey scaffold with weekly rows and no task segments', async () => {
    const wrapper = track(await mountSuspended(BreezyJourney, { props: { journey: [] } }))

    expect(wrapper.find('[aria-label="Work Journey weekly completed tasks"]').exists()).toBe(true)
    expect(wrapper.find('h2').exists()).toBe(false)
    expect(wrapper.find('.sub').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Journey period view"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Journey page navigation"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Your completed-task timeline.')
    expect(wrapper.text()).toContain('0 tasks · 0 minutes tracked')
    expect(wrapper.findAll('.journey-day-label')).toHaveLength(7)
    expect(wrapper.findAll('.journey-segment')).toHaveLength(0)
  })

  it('renders completed task segments from entries and shows the clicked task memory', async () => {
    const wrapper = track(await mountSuspended(BreezyJourney, {
      props: {
        journey: [{
          date: '2026-09-01',
          mood: 'happy',
          airClarityScore: 90,
          hours: 1.5,
          weekLabel: 'September week 1'
        }],
        categories: [{ id: 'cat-software', ownerId: null, name: 'Software' }],
        tasks: [{
          id: 'task-1',
          title: 'Design dashboard empty state',
          description: '',
          categoryId: 'cat-software',
          ownerId: 'user-1',
          isShared: false,
          isArchived: false,
          createdAt: '2026-09-01T00:00:00.000Z',
          members: ['user-1']
        }],
        entries: [{
          id: 'entry-1',
          taskId: 'task-1',
          userId: 'user-1',
          startedAt: '2026-09-01T09:00:00.000Z',
          endedAt: '2026-09-01T10:30:00.000Z',
          durationSeconds: 5400,
          isManual: false,
          isEdited: false,
          idleSeconds: 0,
          excludedIdleSeconds: 0,
          contextSwitches: 3,
          locationLabel: '',
          pauses: [{ startedAt: '2026-09-01T09:40:00.000Z', endedAt: '2026-09-01T09:45:00.000Z', durationSeconds: 300 }],
          feedback: { flowQuality: 'Great flow', efficiencyFeel: 'Felt efficient', energy: 'OK', note: '' },
          blockers: ['Waiting for review'],
          createdAt: '2026-09-01T10:30:00.000Z'
        }]
      }
    }))

    expect(wrapper.text()).toContain('1 task · 1 hour 30 minutes tracked')
    expect(wrapper.text()).toContain('Tue')
    expect(wrapper.text()).toContain('Sep 1')
    expect(wrapper.text()).toContain('Tracked hours')

    const segment = wrapper.get('.journey-segment')
    expect(segment.attributes('aria-label')).toContain('Design dashboard empty state')
    expect(wrapper.get('.journey-segment-wrap').attributes('style')).toContain('--segment-width: 18.75%')
    await segment.trigger('mouseenter')
    expect(wrapper.find('.journey-popover').exists()).toBe(false)
    await segment.trigger('click')

    const popover = wrapper.get('.journey-popover')
    expect(popover.text()).toContain('Design dashboard empty state')
    expect(popover.text()).toContain('Great flow')
    expect(popover.text()).toContain('Waiting for review')
    expect(popover.text()).toContain('1 break')
    expect(popover.text()).toContain('3 context switches')
    expect(wrapper.get('.journey-breezy-marker img').attributes('src')).toContain('/mascots/mascot-journey.png')
  })
})

function track<T extends VueWrapper>(wrapper: T): T {
  wrappers.push(wrapper)
  return wrapper
}
