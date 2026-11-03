import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { createApp } from '../../src/app.ts'
import type { Config } from '../../src/config.ts'
import { UserModel } from '../../src/data/models/user.ts'
import { sessionAuthenticate } from '../../src/http/session-auth.ts'
import { clearDatabase, startDatabase, stopDatabase } from '../database.ts'

beforeAll(startDatabase)
afterEach(clearDatabase)
afterAll(stopDatabase)

const ORCID = 'https://sandbox.orcid.example'
const config: Config = {
  port: 3000,
  publicUrl: 'http://127.0.0.1:5174',
  mongodbUri: undefined,
  mongodbDatabase: 'test',
  orcid: { baseUrl: ORCID, clientId: 'APP-TEST', clientSecret: 'secret' },
  sessionDays: 14,
  siteAdmins: [],
}

// A fake ORCID: its signing keys, and the ID token it hands out for a code
const { publicKey, privateKey } = await generateKeyPair('RS256')
const otherKeys = await generateKeyPair('RS256')
const publishedKeys = { keys: [{ ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' }] }

interface FakeToken {
  nonce: string
  sub?: string
  claims?: Record<string, unknown>
  signWith?: typeof privateKey
  audience?: string
}

function fakeOrcid(token: () => FakeToken): typeof fetch {
  return async (input) => {
    const url = String(input)
    if (url === `${ORCID}/oauth/jwks`) {
      return Response.json(publishedKeys)
    }
    if (url === `${ORCID}/oauth/token`) {
      const { nonce, sub, claims, signWith, audience } = token()
      const idToken = await new SignJWT({ nonce, ...claims })
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
        .setIssuer(ORCID)
        .setAudience(audience ?? 'APP-TEST')
        .setSubject(sub ?? '0000-0002-1825-0097')
        .setIssuedAt()
        .setExpirationTime('10m')
        .sign(signWith ?? privateKey)
      return Response.json({ id_token: idToken })
    }
    return new Response('Not found', { status: 404 })
  }
}

function cookiesFrom(response: request.Response): Record<string, string> {
  const header = response.headers['set-cookie'] as unknown as string[] | undefined
  return Object.fromEntries(
    (header ?? []).map((line) => {
      const [pair = ''] = line.split(';')
      const separator = pair.indexOf('=')
      return [pair.slice(0, separator), pair.slice(separator + 1)]
    }),
  )
}

// Goes to ORCID and comes back, returning the final response and the cookies it set
async function signIn(options: {
  token?: Partial<FakeToken>
  returnTo?: string
  callback?: (state: string) => string
}) {
  let nonce = ''
  const app = createApp({
    authenticate: sessionAuthenticate(),
    config,
    fetch: fakeOrcid(() => ({ nonce, ...options.token })),
  })
  const login = await request(app)
    .get('/api/v1/auth/orcid/login')
    .query({
      returnTo: options.returnTo ?? '/notebooks/1',
    })
  const authorize = new URL(login.headers.location as string)
  nonce = authorize.searchParams.get('nonce') ?? ''
  const state = authorize.searchParams.get('state') ?? ''
  const signInCookie = cookiesFrom(login).protoeln_sign_in ?? ''
  const callback = await request(app)
    .get(options.callback?.(state) ?? `/api/v1/auth/orcid/callback?state=${state}&code=one-time`)
    .set('Cookie', `protoeln_sign_in=${signInCookie}`)
  return { app, login, authorize, callback, state, signInCookie }
}

describe('signing in with ORCID', () => {
  it('sends the browser to ORCID, asking only for the person’s iD', async () => {
    const { login, authorize } = await signIn({})

    expect(login.status).toBe(302)
    expect(`${authorize.origin}${authorize.pathname}`).toBe(`${ORCID}/oauth/authorize`)
    expect(authorize.searchParams.get('client_id')).toBe('APP-TEST')
    expect(authorize.searchParams.get('scope')).toBe('openid')
    expect(authorize.searchParams.get('redirect_uri')).toBe(
      'http://127.0.0.1:5174/api/v1/auth/orcid/callback',
    )
    expect(login.headers['set-cookie']?.[0]).toMatch(/HttpOnly/)
  })

  it('signs the person in, remembers them, and goes back to where they started', async () => {
    const { app, callback } = await signIn({
      token: { claims: { given_name: 'Josiah', family_name: 'Carberry' } },
    })
    const session = cookiesFrom(callback).protoeln_session

    expect(callback.status).toBe(302)
    expect(callback.headers.location).toBe('/notebooks/1')
    expect(String(callback.headers['set-cookie'])).toMatch(/protoeln_session=.+HttpOnly/)
    const me = await request(app).get('/api/v1/me').set('Cookie', `protoeln_session=${session}`)
    expect(me.body.user).toMatchObject({ orcid: '0000-0002-1825-0097', name: 'Josiah Carberry' })
  })

  it('names someone who keeps their name private by their ORCID iD', async () => {
    await signIn({})

    const user = await UserModel.findOne({ orcid: '0000-0002-1825-0097' }).lean()
    expect(user?.name).toBe('0000-0002-1825-0097')
  })

  it('signs out, ending the session', async () => {
    const { app, callback } = await signIn({})
    const cookie = `protoeln_session=${cookiesFrom(callback).protoeln_session}`

    const logout = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie)
    const me = await request(app).get('/api/v1/me').set('Cookie', cookie)

    expect(logout.status).toBe(204)
    expect(me.body.user).toBeNull()
  })

  it('only goes back to pages on this site', async () => {
    const { callback } = await signIn({ returnTo: '//evil.example/steal' })

    expect(callback.headers.location).toBe('/')
  })

  it('signs no one in when the person cancels at ORCID', async () => {
    const { callback } = await signIn({
      callback: (state) => `/api/v1/auth/orcid/callback?state=${state}&error=access_denied`,
    })

    expect(callback.status).toBe(302)
    expect(cookiesFrom(callback).protoeln_session).toBeUndefined()
  })

  it.each([
    ['a token signed with someone else’s key', { signWith: otherKeys.privateKey }],
    ['a token for another app', { audience: 'APP-OTHER' }],
    ['a token for another sign-in', { nonce: 'not-this-one' }],
    ['a token that is not for an ORCID iD', { sub: 'someone' }],
  ])('refuses %s', async (_description, token) => {
    const { callback } = await signIn({ token })

    expect(callback.status).toBe(400)
    expect(callback.body.error).toBe(
      "ORCID's reply couldn't be checked, so you haven't been signed in.",
    )
    expect(await UserModel.countDocuments()).toBe(0)
  })

  it('refuses a callback whose state does not match, or that is used twice', async () => {
    const { app, state, signInCookie } = await signIn({
      callback: (state) => `/api/v1/auth/orcid/callback?state=${state}x&code=one-time`,
    })
    const first = await request(app)
      .get(`/api/v1/auth/orcid/callback?state=${state}&code=one-time`)
      .set('Cookie', `protoeln_sign_in=${signInCookie}`)
    const again = await request(app)
      .get(`/api/v1/auth/orcid/callback?state=${state}&code=one-time`)
      .set('Cookie', `protoeln_sign_in=${signInCookie}`)

    expect(first.status).toBe(302)
    expect(again.status).toBe(400)
  })

  it('says sign-in is not set up when there is no ORCID client', async () => {
    const app = createApp({ config: { ...config, orcid: null } })

    const response = await request(app).get('/api/v1/auth/orcid/login')

    expect(response.status).toBe(503)
  })

  it('treats people listed as site admins as site admins', async () => {
    const { callback } = await signIn({})
    const app = createApp({ authenticate: sessionAuthenticate(['0000-0002-1825-0097']) })

    const me = await request(app)
      .get('/api/v1/me')
      .set('Cookie', `protoeln_session=${cookiesFrom(callback).protoeln_session}`)

    expect(me.body.user.siteAdmin).toBe(true)
  })

  it('goes to the home page if the callback is loaded again by a browser already signed in', async () => {
    const { app, callback, state } = await signIn({})
    const session = cookiesFrom(callback).protoeln_session

    const again = await request(app)
      .get(`/api/v1/auth/orcid/callback?state=${state}&code=one-time`)
      .set('Cookie', `protoeln_session=${session}`)

    expect(again.status).toBe(302)
    expect(again.headers.location).toBe('/')
  })

  it('moves a browser on another name for this site to the public address first', async () => {
    const app = createApp({ config })

    const login = await request(app)
      .get('/api/v1/auth/orcid/login?returnTo=%2Fnotebooks%2F1')
      .set('Host', 'localhost:5174')

    expect(login.status).toBe(302)
    expect(login.headers.location).toBe(
      'http://127.0.0.1:5174/api/v1/auth/orcid/login?returnTo=%2Fnotebooks%2F1',
    )
    expect(login.headers['set-cookie']).toBeUndefined()
  })
})
