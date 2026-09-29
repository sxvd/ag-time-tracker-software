import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  normalizeThemePreference,
  resolveTheme,
  themeBootstrapScript,
  themeStorageKey
} from '../../shared/utils/theme'
import { useTheme } from '../../frontend/composables/useTheme'

let storage: MemoryStorage
let media: MatchMediaController

beforeEach(() => {
  storage = new MemoryStorage()
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage })
  media = new MatchMediaController(false)
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => media)
  })
})

afterEach(() => {
  useTheme().dispose()
  document.documentElement.removeAttribute('data-theme')
  vi.unstubAllGlobals()
})

describe('theme preference lifecycle', () => {
  it('follows OS appearance changes while System is selected', () => {
    const theme = useTheme()
    theme.initialize()

    expect(theme.preference.value).toBe('system')
    expect(theme.resolvedTheme.value).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')

    media.setMatches(true)

    expect(theme.resolvedTheme.value).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('persists an override and ignores later OS changes', () => {
    const theme = useTheme()
    theme.initialize()

    theme.setPreference('light')
    media.setMatches(true)

    expect(theme.preference.value).toBe('light')
    expect(theme.resolvedTheme.value).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(window.localStorage.getItem(themeStorageKey)).toBe('light')

    theme.setPreference('system')
    expect(theme.resolvedTheme.value).toBe('dark')
  })

  it('removes the OS listener during disposal', () => {
    const theme = useTheme()
    theme.initialize()

    theme.dispose()

    expect(media.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })
})

describe('theme preference model', () => {
  it.each([
    [undefined, 'system'],
    [null, 'system'],
    ['', 'system'],
    ['unknown', 'system'],
    ['system', 'system'],
    ['light', 'light'],
    ['dark', 'dark']
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeThemePreference(input)).toBe(expected)
  })

  it('resolves System from the OS while manual preferences override it', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('applies the OS theme before mount when no preference exists', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))

    runBootstrap()

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(window.localStorage.getItem(themeStorageKey)).toBeNull()
  })

  it('preserves an existing manual preference before mount', () => {
    window.localStorage.setItem(themeStorageKey, 'light')
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))

    runBootstrap()

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(window.localStorage.getItem(themeStorageKey)).toBe('light')
  })

  it('replaces an invalid stored preference with System', () => {
    window.localStorage.setItem(themeStorageKey, 'sepia')
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))

    runBootstrap()

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(window.localStorage.getItem(themeStorageKey)).toBe('system')
  })
})

function runBootstrap() {
  Function(themeBootstrapScript())()
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value))
  }
}

class MatchMediaController implements MediaQueryList {
  readonly media = '(prefers-color-scheme: dark)'
  readonly onchange = null
  readonly addEventListener = vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
    if (type === 'change') this.listeners.add(listener)
  })
  readonly removeEventListener = vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
    if (type === 'change') this.listeners.delete(listener)
  })
  private readonly listeners = new Set<EventListenerOrEventListenerObject>()

  constructor(public matches: boolean) {}

  addListener() {}
  removeListener() {}
  dispatchEvent() { return true }

  setMatches(matches: boolean) {
    this.matches = matches
    const event = { matches, media: this.media } as MediaQueryListEvent
    for (const listener of this.listeners) {
      if (typeof listener === 'function') listener(event)
      else listener.handleEvent(event)
    }
  }
}
