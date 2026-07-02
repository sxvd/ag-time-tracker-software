import { createServer } from 'node:http'
import { handleApi, serveStatic } from './backend/api.js'

const port = Number(process.env.PORT || 3000)

createServer(async (req, res) => {
  try {
    if (req.url?.startsWith('/api/')) return await handleApi(req, res)
    return serveStatic(req, res)
  } catch (error) {
    console.error(error)
    res.statusCode = 500
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: 'Internal server error' }))
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`AirGradient Time Tracker running at http://127.0.0.1:${port}`)
})
