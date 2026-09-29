import { describe, expect, it } from 'vitest'
import { withAppBase } from '../../shared/utils/url'

describe('withAppBase', () => {
  it('prefixes API paths with the configured application base URL', () => {
    expect(withAppBase('/tracker/', '/api/bootstrap')).toBe('/tracker/api/bootstrap')
    expect(withAppBase('/', '/api/bootstrap')).toBe('/api/bootstrap')
  })
})
