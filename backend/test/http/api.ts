import type { Request } from 'express'
import request from 'supertest'

import type { CurrentUser } from '../../src/access.ts'
import { createApp } from '../../src/app.ts'
import { findUserById } from '../../src/data/queries.ts'

// The API as tests see it. Instead of signing in, a test names the user making a request in an
// X-Test-User header (a user id); with no header, the request is anonymous.
async function authenticateForTests(req: Request): Promise<CurrentUser | null> {
  const id = req.get('X-Test-User')
  const user = id ? await findUserById(id) : null
  return user
    ? { id: user._id.toHexString(), orcid: user.orcid, name: user.name, siteAdmin: user.siteAdmin }
    : null
}

export function api() {
  return request(createApp({ authenticate: authenticateForTests }))
}
