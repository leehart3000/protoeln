import express, { type Request } from 'express'

import type { CurrentUser } from './access.ts'
import type { Config } from './config.ts'
import { authRoutes } from './http/auth-routes.ts'
import { handleErrors, notFound } from './http/errors.ts'
import { readRoutes } from './http/routes.ts'
import { writeRoutes } from './http/write-routes.ts'

export interface AppOptions {
  // Works out who made a request (null if no one is signed in): from the session cookie when
  // running for real (see http/session-auth.ts); tests can provide their own.
  authenticate?: (req: Request) => Promise<CurrentUser | null>
  // Settings for signing in with ORCID; without them, the sign-in routes aren't served
  config?: Config
  // Used to call ORCID; tests replace it with a fake ORCID
  fetch?: typeof fetch
}

// Every route is under a versioned prefix, as in ProtoLIMS, so a later, incompatible version of
// the API can be served alongside this one
export const API = '/api/v1'

// Builds the API without starting a server, so the same app can run under Node.js locally,
// on Cloudflare Workers, or inside tests.
export function createApp(options: AppOptions = {}) {
  const authenticate = options.authenticate ?? (async () => null)
  const app = express()

  app.disable('x-powered-by')
  app.use(express.json({ limit: '1mb' }))

  app.get(`${API}/health`, (_req, res) => {
    res.json({ status: 'ok' })
  })

  if (options.config) {
    app.use(API, authRoutes({ api: API, config: options.config, fetch: options.fetch }))
  }

  app.use(API, async (req, res, next) => {
    res.locals.user = await authenticate(req)
    next()
  })
  // Where people's ORCID records are, for links to them (the sandbox's, in development)
  app.use(API, readRoutes({ orcidBaseUrl: options.config?.orcid?.baseUrl ?? 'https://orcid.org' }))
  app.use(API, writeRoutes())

  app.use(notFound)
  app.use(handleErrors)

  return app
}
