import { withAppBase } from '~~/shared/utils/url'

const tabSessionTokenKey = 'breezy-tab-session-token'

export interface TrackerTokenStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export interface TrackerFetchOptions {
  body?: unknown
  credentials?: RequestCredentials
  headers?: HeadersInit
  method?: string
  [key: string]: unknown
}

export type TrackerFetcher = (url: string, options?: TrackerFetchOptions) => Promise<unknown>

export function createTrackerApi(options: {
  baseUrl: string
  fetcher: TrackerFetcher
  storage?: TrackerTokenStorage
}) {
  function tabSessionToken() {
    return options.storage?.getItem(tabSessionTokenKey) || ''
  }

  function saveTabSessionToken(token?: string) {
    if (!options.storage) return
    if (token) options.storage.setItem(tabSessionTokenKey, token)
    else options.storage.removeItem(tabSessionTokenKey)
  }

  function authHeaders(extra?: HeadersInit) {
    const headers = new Headers(extra)
    const token = tabSessionToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return headers
  }

  function authFetch<T>(url: string, fetchOptions: TrackerFetchOptions = {}) {
    return options.fetcher(withAppBase(options.baseUrl, url), {
      ...fetchOptions,
      credentials: 'include',
      headers: authHeaders(fetchOptions.headers)
    }) as Promise<T>
  }

  function fetchExport(format: 'csv' | 'json') {
    return authFetch<Blob>(`/api/export?format=${format}`, {
      method: 'GET',
      responseType: 'blob'
    })
  }

  return {
    authFetch,
    fetchExport,
    saveTabSessionToken,
    tabSessionToken
  }
}

export function saveExportBlob(blob: Blob, format: 'csv' | 'json') {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = `airgradient-time.${format}`
  anchor.hidden = true
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

export function useTrackerApi() {
  const baseUrl = useRuntimeConfig().app.baseURL
  return createTrackerApi({
    baseUrl,
    fetcher: $fetch as unknown as TrackerFetcher,
    storage: typeof window === 'undefined' ? undefined : window.sessionStorage
  })
}
