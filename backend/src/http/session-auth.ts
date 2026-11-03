import type { Request } from 'express'

import type { CurrentUser } from '../access.ts'
import { userForSession } from '../data/sessions.ts'
import { readCookie, SESSION_COOKIE } from './cookies.ts'

// Works out who made a request from its session cookie (see auth-routes.ts)
export function sessionAuthenticate(siteAdmins: string[] = []) {
  return async (req: Request): Promise<CurrentUser | null> => {
    const token = readCookie(req, SESSION_COOKIE)
    const user = token === undefined ? null : await userForSession(token)
    if (user === null) {
      return null
    }
    return {
      id: user._id.toHexString(),
      orcid: user.orcid,
      name: user.name,
      siteAdmin: user.siteAdmin || siteAdmins.includes(user.orcid),
    }
  }
}
