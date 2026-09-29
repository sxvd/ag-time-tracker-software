import { describe, expect, it, vi } from 'vitest'
import { createTrackerApi } from '../../frontend/composables/useTrackerApi'
import type { TrackerFetchOptions, TrackerTokenStorage } from '../../frontend/composables/useTrackerApi'

describe('tracker API boundary', () => {
  it('builds tracker-base URLs and always includes cookie credentials', async () => {
    const fetcher = vi.fn(async (_url: string, _options?: TrackerFetchOptions) => ({ ok: true }))
    const api = createTrackerApi({ baseUrl: '/tracker/', fetcher, storage: createStorage() })

    await api.authFetch('/api/bootstrap', {
      method: 'GET',
      credentials: 'omit',
      headers: { 'X-Contract': 'preserved' }
    })

    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher.mock.calls[0]?.[0]).toBe('/tracker/api/bootstrap')
    expect(fetcher.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      method: 'GET',
      credentials: 'include'
    }))
    const headers = fetcher.mock.calls[0]?.[1]?.headers as Headers
    expect(headers.get('X-Contract')).toBe('preserved')
  })

  it('restores, saves, sends, and clears the tab bearer token', async () => {
    const storage = createStorage({ 'breezy-tab-session-token': 'restored-token' })
    const fetcher = vi.fn(async (_url: string, _options?: TrackerFetchOptions) => ({ ok: true }))
    const api = createTrackerApi({ baseUrl: '/tracker/', fetcher, storage })

    expect(api.tabSessionToken()).toBe('restored-token')
    await api.authFetch('/api/bootstrap', { headers: { Authorization: 'Bearer caller-token' } })
    expect((fetcher.mock.calls[0]?.[1]?.headers as Headers).get('Authorization')).toBe('Bearer restored-token')

    api.saveTabSessionToken('replacement-token')
    expect(storage.getItem('breezy-tab-session-token')).toBe('replacement-token')

    api.saveTabSessionToken()
    expect(storage.getItem('breezy-tab-session-token')).toBeNull()

    await api.authFetch('/api/bootstrap')
    expect((fetcher.mock.calls[1]?.[1]?.headers as Headers).has('Authorization')).toBe(false)
  })

  it('propagates fetch failures without retrying or replacing them', async () => {
    const failure = new Error('bootstrap failed')
    const fetcher = vi.fn(async (_url: string, _options?: TrackerFetchOptions) => { throw failure })
    const api = createTrackerApi({ baseUrl: '/tracker/', fetcher, storage: createStorage() })

    await expect(api.authFetch('/api/bootstrap')).rejects.toBe(failure)
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('fetches each export as a bearer-authenticated blob for the initiating tab', async () => {
    const fetcher = vi.fn(async (url: string, options?: TrackerFetchOptions) => {
      const token = (options?.headers as Headers).get('Authorization')
      return new Blob([`${token}:${url}`], { type: 'text/plain' })
    })
    const first = createTrackerApi({
      baseUrl: '/tracker/',
      fetcher,
      storage: createStorage({ 'breezy-tab-session-token': 'first-tab-token' })
    })
    const second = createTrackerApi({
      baseUrl: '/tracker/',
      fetcher,
      storage: createStorage({ 'breezy-tab-session-token': 'second-tab-token' })
    })

    const firstDownload = await first.fetchExport('csv')
    const secondDownload = await second.fetchExport('json')

    expect(await firstDownload.text()).toBe('Bearer first-tab-token:/tracker/api/export?format=csv')
    expect(await secondDownload.text()).toBe('Bearer second-tab-token:/tracker/api/export?format=json')
    expect(fetcher.mock.calls.map(([, options]) => ({
      credentials: options?.credentials,
      responseType: options?.responseType,
      authorization: (options?.headers as Headers).get('Authorization')
    }))).toEqual([
      { credentials: 'include', responseType: 'blob', authorization: 'Bearer first-tab-token' },
      { credentials: 'include', responseType: 'blob', authorization: 'Bearer second-tab-token' }
    ])
  })
})

function createStorage(initial: Record<string, string> = {}): TrackerTokenStorage {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) }
  }
}
