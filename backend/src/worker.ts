import { handleAsNodeRequest } from 'cloudflare:node'
import { DurableObject } from 'cloudflare:workers'
import mongoose from 'mongoose'

import { createApp } from './app.ts'
import { readConfig } from './config.ts'
import { sessionAuthenticate } from './http/session-auth.ts'

// Runs ProtoELN on Cloudflare Workers (see docs/deployment.md): the website's files are served
// by Cloudflare, and requests to /api go to the API, which is the same Express app as under
// Node.js (server.ts).
//
// The API runs in one Durable Object, which keeps its MongoDB connection open between
// requests. A plain Worker can't reuse a connection from one request in the next, so it would
// have to connect to Atlas afresh for every request. The Durable Object is placed in western
// Europe, near the Atlas cluster (AWS Ireland).

interface Env {
  API: DurableObjectNamespace
  ASSETS: Fetcher
  // Settings (see .env.example), from wrangler.jsonc's vars and from secrets
  [setting: string]: unknown
}

// The port the Express app listens on, inside the Worker (no real network port is opened)
const PORT = 8080

// Settings are text; anything else in the environment (such as bindings) isn't a setting
function settingsFrom(env: Env): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

let listening = false

export class Api extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    const config = readConfig(settingsFrom(env))
    const uri = config.mongodbUri
    if (uri === undefined) {
      throw new Error('Set the PROTOELN_MONGODB_URI secret (see docs/deployment.md)')
    }
    // The app is started once per Worker instance, however many times this object is made
    if (!listening) {
      createApp({ authenticate: sessionAuthenticate(config.siteAdmins), config }).listen(PORT)
      listening = true
    }
    // Requests wait until the database is connected
    void ctx.blockConcurrencyWhile(async () => {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(uri, {
          dbName: config.mongodbDatabase,
          maxPoolSize: 5,
          serverSelectionTimeoutMS: 10_000,
        })
      }
    })
  }

  async fetch(request: Request): Promise<Response> {
    return handleAsNodeRequest(PORT, request)
  }
}

function isApiPath(pathname: string) {
  return pathname === '/api' || pathname.startsWith('/api/')
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (isApiPath(new URL(request.url).pathname)) {
      const api = env.API.get(env.API.idFromName('api'), { locationHint: 'weur' })
      return api.fetch(request)
    }
    return env.ASSETS.fetch(request)
  },
}
