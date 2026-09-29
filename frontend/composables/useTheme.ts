import { readonly, ref } from 'vue'
import type { ResolvedTheme, ThemePreference } from '~~/shared/utils/theme'
import { normalizeThemePreference, resolveTheme, themeStorageKey } from '~~/shared/utils/theme'

const preference = ref<ThemePreference>('system')
const resolvedTheme = ref<ResolvedTheme>('light')
let mediaQuery: MediaQueryList | null = null
let initialized = false

function applyResolvedTheme(prefersDark: boolean) {
  resolvedTheme.value = resolveTheme(preference.value, prefersDark)
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolvedTheme.value
  }
}

function handleSystemThemeChange(event: MediaQueryListEvent) {
  if (preference.value === 'system') applyResolvedTheme(event.matches)
}

function initialize() {
  if (initialized || typeof window === 'undefined' || typeof document === 'undefined') return

  let stored: string | null = null
  try {
    stored = window.localStorage.getItem(themeStorageKey)
  } catch {
    stored = null
  }
  preference.value = normalizeThemePreference(stored)
  if (stored !== null && stored !== preference.value) {
    try {
      window.localStorage.setItem(themeStorageKey, preference.value)
    } catch {
      // The resolved theme still works when browser storage is unavailable.
    }
  }

  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', handleSystemThemeChange)
  initialized = true
  applyResolvedTheme(mediaQuery.matches)
}

function setPreference(value: ThemePreference) {
  if (!initialized) initialize()
  preference.value = normalizeThemePreference(value)
  try {
    window.localStorage.setItem(themeStorageKey, preference.value)
  } catch {
    // Applying the preference does not depend on storage being writable.
  }
  applyResolvedTheme(Boolean(mediaQuery?.matches))
}

function dispose() {
  mediaQuery?.removeEventListener('change', handleSystemThemeChange)
  mediaQuery = null
  initialized = false
}

export function useTheme() {
  return {
    preference: readonly(preference),
    resolvedTheme: readonly(resolvedTheme),
    setPreference,
    initialize,
    dispose
  }
}
