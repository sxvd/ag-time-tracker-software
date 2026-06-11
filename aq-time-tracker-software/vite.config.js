import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { handleApi } from './backend/api.js'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'ag-time-tracker-api',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/api/')) return next()
          try {
            await handleApi(req, res)
          } catch (error) {
            console.error(error)
            res.statusCode = 500
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ error: 'Internal server error' }))
          }
        })
      },
    },
  ],
})
