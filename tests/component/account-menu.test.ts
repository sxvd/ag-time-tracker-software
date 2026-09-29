import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AccountMenu from '../../frontend/features/settings/AccountMenu.vue'

const user = {
  displayName: 'Mog',
  email: 'mog@airgradient.com',
  team: 'Software'
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('AccountMenu', () => {
  it('opens a labelled account dialog and exposes the signed-in identity', async () => {
    const wrapper = await mountAccountMenu()
    const trigger = wrapper.get('[aria-haspopup="dialog"]')

    expect(trigger.element.tagName).toBe('BUTTON')
    expect(trigger.attributes('aria-expanded')).toBe('false')

    await trigger.trigger('click')

    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('[role="dialog"]').attributes('aria-label')).toBe('Account')
    expect(wrapper.text()).toContain('Mog')
    expect(wrapper.text()).toContain('mog@airgradient.com')
    expect(wrapper.text()).toContain('Software')
  })

  it('opens from the keyboard with Enter', async () => {
    const wrapper = await mountAccountMenu()

    await wrapper.get('[aria-haspopup="dialog"]').trigger('keydown.enter')

    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
  })

  it.each([
    ['system', 'theme-system'],
    ['light', 'theme-light'],
    ['dark', 'theme-dark']
  ] as const)('emits the exact %s theme preference without closing', async (preference, testId) => {
    const wrapper = await mountAccountMenu()
    await wrapper.get('[aria-haspopup="dialog"]').trigger('click')

    await wrapper.get(`[data-testid="${testId}"]`).trigger('click')

    expect(wrapper.emitted('themeChange')).toEqual([[preference]])
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
  })

  it('closes before requesting the Settings page', async () => {
    const wrapper = await mountAccountMenu()
    await wrapper.get('[aria-haspopup="dialog"]').trigger('click')

    await wrapper.get('[data-testid="open-settings"]').trigger('click')

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.emitted('openSettings')).toEqual([[]])
  })

  it('closes before requesting logout', async () => {
    const wrapper = await mountAccountMenu()
    await wrapper.get('[aria-haspopup="dialog"]').trigger('click')

    await wrapper.get('[data-testid="logout"]').trigger('click')

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.emitted('logout')).toEqual([[]])
  })

  it('closes on Escape and restores focus to the account trigger', async () => {
    const wrapper = await mountAccountMenu()
    const trigger = wrapper.get<HTMLButtonElement>('[aria-haspopup="dialog"]')
    await trigger.trigger('click')
    wrapper.get<HTMLButtonElement>('[data-testid="open-settings"]').element.focus()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)
  })

  it('closes when a pointer event occurs outside the component', async () => {
    const wrapper = await mountAccountMenu()
    await wrapper.get('[aria-haspopup="dialog"]').trigger('click')

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('removes document listeners when unmounted while open', async () => {
    const removeEventListener = vi.spyOn(document, 'removeEventListener')
    const wrapper = await mountAccountMenu()
    await wrapper.get('[aria-haspopup="dialog"]').trigger('click')

    wrapper.unmount()

    expect(removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(removeEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function))
  })
})

async function mountAccountMenu() {
  return mountSuspended(AccountMenu, {
    attachTo: document.body,
    props: {
      user,
      initials: 'M',
      themePreference: 'system'
    }
  })
}
