import express, { type Request } from 'express'

import type { CurrentUser } from './access.ts'
import { handleErrors, notFound } from './http/errors.ts'
import { readRoutes } from './http/routes.ts'

export interface AppOptions {
  // Works out who made a request (null if no one is signed in). Sign-in with ORCID will provide
  // this; tests provide their own.
  authenticate?: (req: Request) => Promise<CurrentUser | null>
}

// Builds the API without starting a server, so the same app can run under Node.js locally,
// on Cloudflare Workers, or inside tests.
export function createApp(options: AppOptions = {}) {
  const authenticate = options.authenticate ?? (async () => null)
  const app = express()

  app.disable('x-powered-by')
  app.use(express.json({ limit: '1mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/api', async (req, res, next) => {
    res.locals.user = await authenticate(req)
    next()
  })
  app.use('/api', readRoutes())

  app.use(notFound)
  app.use(handleErrors)

  return app
}
