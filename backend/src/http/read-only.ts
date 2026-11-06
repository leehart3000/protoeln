import type { RequestHandler } from 'express'

// The read-only lock (PROTOELN_READ_ONLY; see docs/read-only.md), as ProtoLIMS's: while it's
// on, everything can still be read, and people can sign in and out, but every other request,
// from anyone (site admins included), is refused with 423 Locked. It's a server setting, so
// only whoever runs the server can lift it, never a website session.

export const READ_ONLY_MESSAGE = 'This site is read-only at the moment, so nothing can be changed.'

// Requests that only read
const READING = new Set(['GET', 'HEAD', 'OPTIONS'])

// Other requests allowed while it's on, as method and path (under /api/v1). Signing in is
// reading (it's done with GET requests); signing out ends only your own session.
const ALLOWED = [{ method: 'POST', path: '/auth/logout' }]

export function refuseChanges(): RequestHandler {
  return (req, res, next) => {
    const allowed =
      READING.has(req.method) ||
      ALLOWED.some(({ method, path }) => req.method === method && req.path === path)
    if (allowed) {
      next()
    } else {
      res.status(423).json({ error: READ_ONLY_MESSAGE })
    }
  }
}
