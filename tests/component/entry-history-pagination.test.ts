import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import EntryHistory from '../../frontend/features/dashboard/EntryHistory.vue'
import type { ApiEntry } from '../../frontend/types/api'

function entries(count: number): ApiEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `entry-${index + 1}`,
    taskId: `task-${index + 1}`,
    userId: 'u1',
    startedAt: `2026-09-04T${String(index).padStart(2, '0')}:00:00.000Z`,
    endedAt: `2026-09-04T${String(index).padStart(2, '0')}:30:00.000Z`,
    durationSeconds: 1800,
    isManual: false,
    isEdited: false,
    idleSeconds: 0,
    excludedIdleSeconds: 0,
    contextSwitches: 0,
    locationLabel: '',
    pauses: [],
    blockers: [],
    createdAt: `2026-09-04T${String(index).padStart(2, '0')}:00:00.000Z`
  }))
}

describe('EntryHistory pagination', () => {
  it('shows five entries per page and provides reversible navigation', async () => {
    const wrapper = await mountSuspended(EntryHistory, {
      props: {
        entries: entries(12),
        scope: 'Individual',
        currentUserId: 'u1',
        taskName: (taskId: string) => taskId,
        userName: (userId: string) => userId
      }
    })

    expect(wrapper.findAll('tbody tr')).toHaveLength(5)
    expect(wrapper.get('tbody th').text()).toBe('task-1')
    expect(wrapper.get('.entry-pagination-status').text()).toBe('1 / 3')
    expect(wrapper.get('.entry-pagination-status').attributes('aria-label')).toBe('Page 1 of 3')
    expect(wrapper.get('button[aria-label="Previous entries"]').attributes()).toHaveProperty('disabled')

    await wrapper.get('button[aria-label="Next entries"]').trigger('click')
    expect(wrapper.findAll('tbody tr')).toHaveLength(5)
    expect(wrapper.get('tbody th').text()).toBe('task-6')
    expect(wrapper.get('.entry-pagination-status').text()).toBe('2 / 3')

    await wrapper.get('button[aria-label="Next entries"]').trigger('click')
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.get('tbody th').text()).toBe('task-11')
    expect(wrapper.get('.entry-pagination-status').text()).toBe('3 / 3')
    expect(wrapper.get('button[aria-label="Next entries"]').attributes()).toHaveProperty('disabled')

    await wrapper.get('button[aria-label="Previous entries"]').trigger('click')
    expect(wrapper.get('tbody th').text()).toBe('task-6')
  })

  it('shows a disabled single-page control for five or fewer entries', async () => {
    const wrapper = await mountSuspended(EntryHistory, {
      props: {
        entries: entries(5),
        scope: 'Individual',
        currentUserId: 'u1',
        taskName: (taskId: string) => taskId,
        userName: (userId: string) => userId
      }
    })

    expect(wrapper.findAll('tbody tr')).toHaveLength(5)
    expect(wrapper.get('.entry-pagination-status').text()).toBe('1 / 1')
    expect(wrapper.get('button[aria-label="Previous entries"]').attributes()).toHaveProperty('disabled')
    expect(wrapper.get('button[aria-label="Next entries"]').attributes()).toHaveProperty('disabled')
    expect(wrapper.get('button[aria-label="Previous entries"]').text()).toBe('')
    expect(wrapper.get('button[aria-label="Next entries"]').text()).toBe('')
    expect(wrapper.findAll('.entry-page-button svg')).toHaveLength(2)
  })
})
