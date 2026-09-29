import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountTrackerApp } from './helpers/app-fixture'

afterEach(() => {
  document.body.innerHTML = ''
  window.sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe('frontend refactor app fixture', () => {
  it('mounts the unchanged authenticated shell from representative bootstrap data', async () => {
    const { wrapper, fetchMock, state } = await mountTrackerApp()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/bootstrap$/),
      expect.objectContaining({ credentials: 'include' })
    )
    expect(wrapper.find('main.app-shell').exists()).toBe(true)
    expect(wrapper.text()).toContain(state.tasks[0].title)

    wrapper.unmount()
  })
})
