import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const frontendDir = fileURLToPath(new URL('./frontend', import.meta.url))
const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/integration/**/*.test.ts'],
    fileParallelism: false
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
