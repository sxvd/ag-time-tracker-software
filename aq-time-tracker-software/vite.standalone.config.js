import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'standalone-dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'standalone.entry.html',
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
