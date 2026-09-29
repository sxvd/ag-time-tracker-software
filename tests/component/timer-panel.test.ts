import { mountSuspended } from '@nuxt/test-utils/runtime'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import IdleDecisionModal from '../../frontend/features/tracking/IdleDecisionModal.vue'
import TimerPanel from '../../frontend/features/tracking/TimerPanel.vue'
import type { ApiEntry } from '../../frontend/types/api'

const wrappers: Array<Awaited<ReturnType<typeof mountSuspended>>> = []

afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
})

describe('TimerPanel', () => {
  it('preserves the ready state, live values, classes, labels, and action order', async () => {
    const ready = track(await mountSuspended(TimerPanel, { props: timerProps() }))

    expect(ready.get('article').classes()).toEqual(expect.arrayContaining(['card', 'pad', 'timer-panel']))
    expect(ready.get('h2').text()).toBe('Start your task')
    expect(ready.find('.status-pill').exists()).toBe(false)
    expect(ready.get('.task-composer label').text()).toBe('')
    expect(ready.get('.task-composer input').attributes('aria-label')).toBe('Task name')
    expect(ready.get('.timer-readout').text()).toBe('00:00:00')
    expect(ready.get('.timer-primary-button').attributes('aria-label')).toBe('Start')
    expect(ready.get('.timer-primary-button').attributes('title')).toBe('Start')
    expect(ready.get('.timer-primary-button').attributes()).toHaveProperty('disabled')
    expect(ready.get('.timer-primary-button').classes()).toContain('is-start')
    expect(ready.get('.timer-primary-button').text()).toBe('')
    expect(ready.get('.timer-action-icon').classes()).toContain('is-play')
    expect(ready.get('.timer-display-row').element.children[0]).toBe(ready.get('.timer-readout').element)
    expect(ready.get('.timer-display-row').element.children[1]).toBe(ready.get('.timer-primary-button').element)
    expect(ready.find('.timer-controls .orange').exists()).toBe(false)
    expect(ready.find('.breezy-line').exists()).toBe(false)
    expect(statLabels(ready)).toEqual(['Task category', 'Inactive time', 'Context switches'])
    expect(statValues(ready)).toEqual(['Deep work', '0m', '0'])

    const running = track(await mountSuspended(TimerPanel, {
      props: timerProps({
        activeEntry: entry(),
        activeTaskTitle: 'Production readiness review',
        elapsedSeconds: 3_661,
        idleSeconds: 125,
        contextSwitches: 7,
        hasInlineTaskTitle: true,
        inlineTaskTitle: 'Production readiness review',
        primaryTimerLabel: 'Take a Break'
      })
    }))

    expect(running.get('h2').text()).toBe('Production readiness review')
    expect(running.find('.status-pill').exists()).toBe(false)
    expect(running.get('.timer-readout').text()).toBe('01:01:01')
    expect(running.get('.timer-primary-button').classes()).toContain('is-break')
    expect(running.get('.timer-primary-button').attributes('title')).toBe('Take a Break')
    expect(running.get('.timer-action-icon').classes()).toContain('is-pause')
    expect(running.get('.timer-display-row').element.children[0]).toBe(running.get('.timer-readout').element)
    expect(running.get('.timer-display-row').element.children[1]).toBe(running.get('.timer-primary-button').element)
    expect(running.get('.timer-display-row').element.children[2]).toBe(running.get('.timer-stop-button').element)
    expect(running.find('.timer-controls').exists()).toBe(false)
    expect(running.get('.timer-stop-button').text()).toBe('Stop')
    expect(statValues(running)).toEqual(['Deep work', '2m', '7'])

    await running.get('.timer-primary-button').trigger('click')
    await running.get('.timer-stop-button').trigger('click')
    expect(running.emitted('primaryAction')).toHaveLength(1)
    expect(running.emitted('stop')).toHaveLength(1)
  })

  it('preserves paused state and forwards task input focus and task-composer events', async () => {
    const wrapper = track(await mountSuspended(TimerPanel, {
      attachTo: document.body,
      props: timerProps({
        activeEntry: entry({
          pauses: [{
            startedAt: '2026-08-25T10:20:00.000Z',
            endedAt: null,
            durationSeconds: null
          }]
        }),
        hasInlineTaskTitle: true,
        inlineTaskTitle: 'Paused work',
        isUpdatingPause: true,
        pausedAt: '2026-08-25T10:20:00.000Z',
        primaryTimerLabel: 'Resume'
      })
    }))

    expect(wrapper.get('.timer-primary-button').classes()).toContain('is-resume')
    expect(wrapper.get('.timer-primary-button').attributes('title')).toBe('Resume')
    expect(wrapper.get('.timer-action-icon').classes()).toContain('is-play')
    expect(wrapper.get('.timer-primary-button').attributes()).toHaveProperty('disabled')

    wrapper.vm.focusTaskInput()
    await nextTick()
    expect(document.activeElement).toBe(wrapper.get('[aria-label="Task name"]').element)

    await wrapper.get('[aria-label="Task name"]').setValue('Changed title')
    await wrapper.get('.category-tags button').trigger('click')
    expect(wrapper.emitted('update:inlineTaskTitle')?.at(-1)).toEqual(['Changed title'])
    expect(wrapper.emitted('draftChange')).toHaveLength(1)
    expect(wrapper.emitted('selectCategory')).toEqual([['category-deep-work']])
  })
})

describe('IdleDecisionModal', () => {
  it('keeps its labelled dialog, exact action labels, autofocus, and decision values after moving', async () => {
    const wrapper = track(await mountSuspended(IdleDecisionModal, {
      attachTo: document.body,
      props: { idleSeconds: 301 }
    }))
    await nextTick()

    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(dialog.attributes('aria-labelledby')).toBe('idle-decision-title')
    expect(dialog.attributes('aria-describedby')).toBe('idle-decision-description')
    expect(dialog.get('h2').text()).toBe('No activity detected')
    expect(dialog.text()).toContain('We noticed no keyboard or mouse activity for 5 minutes.')
    const buttons = dialog.findAll('button')
    expect(buttons.map(button => button.text())).toEqual([
      'Keep as work',
      'Exclude this time',
      'Save as break'
    ])
    expect(document.activeElement).toBe(buttons[0]!.element)

    await buttons[0]!.trigger('click')
    await buttons[1]!.trigger('click')
    await buttons[2]!.trigger('click')
    expect(wrapper.emitted('select')).toEqual([['keep'], ['discard'], ['break']])
  })
})

function timerProps(overrides: Record<string, unknown> = {}) {
  return {
    activeEntry: null,
    activeTaskTitle: '',
    categories: [{ id: 'category-deep-work', ownerId: null, name: 'Deep work' }],
    categoryName: () => 'Deep work',
    contextSwitches: 0,
    currentCategoryName: 'Deep work',
    elapsedSeconds: 0,
    hasInlineTaskTitle: false,
    idleSeconds: 0,
    inlineCategoryId: 'category-deep-work',
    inlineTaskTitle: '',
    isUpdatingPause: false,
    pausedAt: null,
    primaryTimerLabel: 'Start',
    shareableTask: null,
    sharedTasks: [],
    userName: () => 'Team member',
    ...overrides
  }
}

function statValues(wrapper: Awaited<ReturnType<typeof mountSuspended>>) {
  return wrapper.findAll('.timer-stats dd').map((value: { text: () => string }) => value.text())
}

function statLabels(wrapper: Awaited<ReturnType<typeof mountSuspended>>) {
  return wrapper.findAll('.timer-stats dt').map((value: { text: () => string }) => value.text())
}

function entry(overrides: Partial<ApiEntry> = {}): ApiEntry {
  return {
    id: 'entry-1',
    taskId: 'task-1',
    userId: 'user-1',
    startedAt: '2026-08-25T10:00:00.000Z',
    endedAt: null,
    durationSeconds: 0,
    isManual: false,
    isEdited: false,
    idleSeconds: 0,
    excludedIdleSeconds: 0,
    contextSwitches: 0,
    locationLabel: '',
    pauses: [],
    blockers: [],
    createdAt: '2026-08-25T10:00:00.000Z',
    ...overrides
  }
}

function track<T extends Awaited<ReturnType<typeof mountSuspended>>>(wrapper: T): T {
  wrappers.push(wrapper)
  return wrapper
}
