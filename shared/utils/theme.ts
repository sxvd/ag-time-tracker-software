export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const themeStorageKey = 'breezy-theme-mode'

export function normalizeThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return prefersDark ? 'dark' : 'light'
  return preference
}

export function themeBootstrapScript() {
  return `(() => {
    const key = ${JSON.stringify(themeStorageKey)};
    let stored = null;
    try { stored = window.localStorage.getItem(key); } catch {}
    const preference = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    if (stored !== null && stored !== preference) {
      try { window.localStorage.setItem(key, preference); } catch {}
    }
    const prefersDark = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = preference === 'system'
      ? (prefersDark ? 'dark' : 'light')
      : preference;
  })();`
}
