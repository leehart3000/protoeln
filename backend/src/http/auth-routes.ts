import { Router, type CookieOptions } from 'express'

import { authorizeUrl, checkIdToken, exchangeCode, SignInError } from '../auth/orcid.ts'
import { randomToken, sameSecret } from '../auth/tokens.ts'
import type { Config } from '../config.ts'
import { SIGN_IN_MINUTES } from '../data/models/session.ts'
import {
  endSession,
  finishSignIn,
  rememberUser,
  startSession,
  startSignIn,
  userForSession,
} from '../data/sessions.ts'
import { readCookie, SESSION_COOKIE, SIGN_IN_COOKIE } from './cookies.ts'

// Signing in with ORCID and signing out. The API does the whole sign-in itself, so the browser
// never holds any tokens (as in ProtoLIMS):
//
// 1. /auth/orcid/login sends the browser to ORCID, with a random "state" (also kept in a
//    short-lived cookie) and "nonce".
// 2. ORCID sends the browser back to /auth/orcid/callback with a one-time code. The API checks
//    the state, swaps the code for an ID token, and checks the token (see auth/orcid.ts).
// 3. The API remembers the person by their ORCID iD and gives the browser a session cookie,
//    which page scripts can't read (HttpOnly). Only a hash of it is stored.

const INVALID_SIGN_IN = "This sign-in has expired or isn't valid. Please sign in again."

// Only go back to a page on this site: a path starting with a single slash
export function safeReturnTo(value: unknown): string {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.startsWith('/\\')
    ? value
    : '/'
}

export function authRoutes(options: { api: string; config: Config; fetch?: typeof fetch }) {
  const { api, config } = options
  const router = Router()
  const redirectUri = `${config.publicUrl}${api}/auth/orcid/callback`
  const cookie = (path: string, maxAgeMs: number): CookieOptions => ({
    path,
    maxAge: maxAgeMs,
    httpOnly: true,
    sameSite: 'lax',
    secure: config.publicUrl.startsWith('https://'),
  })

  function orcidSettings() {
    if (config.orcid === null) {
      throw new SignInError("Sign-in with ORCID isn't set up on this server", 503)
    }
    return config.orcid
  }

  router.get('/auth/orcid/login', async (req, res) => {
    const settings = orcidSettings()
    const state = randomToken()
    const nonce = randomToken()
    await startSignIn(state, nonce, safeReturnTo(req.query.returnTo))
    res.cookie(SIGN_IN_COOKIE, state, cookie(`${api}/auth`, SIGN_IN_MINUTES * 60 * 1000))
    res.redirect(302, authorizeUrl(settings, redirectUri, state, nonce))
  })

  router.get('/auth/orcid/callback', async (req, res) => {
    const settings = orcidSettings()
    const state = typeof req.query.state === 'string' ? req.query.state : undefined
    const expected = readCookie(req, SIGN_IN_COOKIE)
    // Why a sign-in was refused goes to the server's log (never to the browser), for diagnosis.
    // If the browser is signed in already (say, the callback was loaded a second time after it
    // succeeded), it just goes to the home page rather than showing an error.
    const refuse = async (reason: string) => {
      console.warn(`Sign-in refused: ${reason}`)
      const session = readCookie(req, SESSION_COOKIE)
      if (session !== undefined && (await userForSession(session)) !== null) {
        res.redirect(302, '/')
        return
      }
      throw new SignInError(INVALID_SIGN_IN)
    }
    if (state === undefined) {
      return refuse('ORCID sent no state')
    }
    if (expected === undefined) {
      return refuse(`the browser sent no ${SIGN_IN_COOKIE} cookie`)
    }
    if (!sameSecret(state, expected)) {
      return refuse(`the state doesn't match the ${SIGN_IN_COOKIE} cookie`)
    }
    const attempt = await finishSignIn(state)
    if (attempt === null) {
      return refuse('no sign-in attempt matches (older than 10 minutes, or already used)')
    }
    res.clearCookie(SIGN_IN_COOKIE, { path: `${api}/auth` })

    // Cancelled at ORCID: nobody is signed in, and the browser just goes back
    const code = typeof req.query.code === 'string' ? req.query.code : undefined
    if (req.query.error !== undefined || code === undefined) {
      res.redirect(302, attempt.returnTo)
      return
    }

    const idToken = await exchangeCode(settings, redirectUri, code, options.fetch)
    const person = await checkIdToken(settings, idToken, attempt.nonce, options.fetch)
    const user = await rememberUser(person.orcid, person.name)
    const token = await startSession(user._id, config.sessionDays)
    console.log(`Signed in ${person.orcid}`)
    res.cookie(SESSION_COOKIE, token, cookie('/', config.sessionDays * 24 * 60 * 60 * 1000))
    res.redirect(302, attempt.returnTo)
  })

  router.post('/auth/logout', async (req, res) => {
    const token = readCookie(req, SESSION_COOKIE)
    if (token !== undefined) {
      await endSession(token)
    }
    res.clearCookie(SESSION_COOKIE, { path: '/' })
    res.status(204).end()
  })

  return router
}
