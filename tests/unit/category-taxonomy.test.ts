import { describe, expect, it } from 'vitest'

import { DEFAULT_CATEGORY_NAMES } from '../../shared/constants/categories.mjs'

describe('default category taxonomy', () => {
  it('uses the approved AirGradient work categories in display order', () => {
    expect(DEFAULT_CATEGORY_NAMES).toEqual([
      'Software',
      'Hardware',
      'Firmware',
      'Communication',
      'Research',
      'Commerce',
      'Production',
      'Other'
    ])
  })
})
