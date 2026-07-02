import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const frontendDir = fileURLToPath(new URL('./frontend', import.meta.url))
const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/**/*.test.ts']
  },
  resolve: {
    alias: {
      '~': frontendDir,
      '@': frontendDir,
      '~~': rootDir,
      '@@': rootDir
    }
  }
})
