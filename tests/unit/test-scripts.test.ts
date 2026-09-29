import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const packageJsonPath = resolve(__dirname, '../../package.json')

describe('test scripts', () => {
  it('prepares Nuxt generated configuration before every test entrypoint', () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      scripts: Record<string, string>
    }

    expect(packageJson.scripts['test:prepare']).toBe('nuxt prepare')
    expect(packageJson.scripts.pretest).toBe('npm run test:prepare')
    expect(packageJson.scripts['pretest:component']).toBe('npm run test:prepare')
    expect(packageJson.scripts['pretest:integration']).toBe('npm run test:prepare')
  })
})
