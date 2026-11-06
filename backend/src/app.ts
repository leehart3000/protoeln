import express, { type Request } from 'express'

import type { CurrentUser } from './access.ts'
import type { Config } from './config.ts'
import { authRoutes } from './http/auth-routes.ts'
import { s3Store } from './files/s3.ts'
import type { FileStore } from './files/store.ts'
import { detailRoutes } from './http/detail-routes.ts'
import { handleErrors, notFound } from './http/errors.ts'
import { fileRoutes } from './http/file-routes.ts'
import { memberRoutes } from './http/member-routes.ts'
import { refuseChanges } from './http/read-only.ts'
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
  // The read-only lock (see http/read-only.ts); from the settings, unless given here (in tests)
  readOnly?: boolean
  // Whether anyone can read the site's public projects (see canRead in access.ts); from the
  // settings, unless given here (in tests). Off if neither says.
  publicRead?: boolean
  // Where files are kept (see files/store.ts); from the settings, unless given here (in tests)
  files?: FileStore | null
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

  const readOnly = options.readOnly ?? options.config?.readOnly ?? false
  if (readOnly) {
    app.use(API, refuseChanges())
  }

  if (options.config) {
    app.use(API, authRoutes({ api: API, config: options.config, fetch: options.fetch }))
  }

  const publicRead = options.publicRead ?? options.config?.publicRead ?? false
  app.use(API, async (req, res, next) => {
    res.locals.user = await authenticate(req)
    res.locals.sitePublicRead = publicRead
    next()
  })
  // Where people's ORCID records are, for links to them (the sandbox's, in development)
  const orcidBaseUrl = options.config?.orcid?.baseUrl ?? 'https://orcid.org'
  app.use(API, readRoutes({ orcidBaseUrl, readOnly, publicRead }))
  app.use(API, writeRoutes())
  app.use(API, detailRoutes())
  app.use(API, memberRoutes({ orcidBaseUrl }))
  const fileSettings = options.config?.files
  const files = options.files ?? (fileSettings ? s3Store(fileSettings) : null)
  app.use(API, fileRoutes(files))

  app.use(notFound)
  app.use(handleErrors)

  return app
}
