import express from 'express'

// Builds the API without starting a server, so the same app can run under Node.js locally,
// on Cloudflare Workers, or inside tests.
export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.use(express.json({ limit: '1mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  return app
}
