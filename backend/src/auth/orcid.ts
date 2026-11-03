import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from 'jose'

import type { OrcidSettings } from '../config.ts'
import { isValidOrcid } from '../data/orcid.ts'
import { sameSecret } from './tokens.ts'

// Signing in with ORCID, using OpenID Connect. ORCID sends the browser back with a one-time code,
// which the API swaps for an ID token: a statement, signed by ORCID, of who the person is. The
// token is only trusted once its signature checks out against ORCID's published keys, and it was
// issued by ORCID, for this app, recently, and for this sign-in (its nonce).

export class SignInError extends Error {
  readonly status: number

  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export const UNCHECKED_REPLY = "ORCID's reply couldn't be checked, so you haven't been signed in."

export function authorizeUrl(
  settings: OrcidSettings,
  redirectUri: string,
  state: string,
  nonce: string,
): string {
  const query = new URLSearchParams({
    client_id: settings.clientId,
    response_type: 'code',
    scope: 'openid',
    redirect_uri: redirectUri,
    state,
    nonce,
  })
  return `${settings.baseUrl}/oauth/authorize?${query}`
}

// Swaps the one-time code for an ID token. The client secret is sent only from here, server to
// server, and never reaches the browser.
export async function exchangeCode(
  settings: OrcidSettings,
  redirectUri: string,
  code: string,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const response = await fetchFn(`${settings.baseUrl}/oauth/token`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })
  const body: unknown = response.ok ? await response.json() : null
  const idToken = (body as { id_token?: unknown } | null)?.id_token
  if (typeof idToken !== 'string') {
    throw new SignInError("ORCID didn't complete the sign-in. Please try again.", 502)
  }
  return idToken
}

export interface Person {
  orcid: string
  // Their name, if they have made it public on ORCID
  name: string | null
}

export async function checkIdToken(
  settings: OrcidSettings,
  idToken: string,
  nonce: string,
  fetchFn: typeof fetch = fetch,
): Promise<Person> {
  let payload
  try {
    const keys = (await (await fetchFn(`${settings.baseUrl}/oauth/jwks`)).json()) as JSONWebKeySet
    const result = await jwtVerify(idToken, createLocalJWKSet(keys), {
      issuer: settings.baseUrl,
      audience: settings.clientId,
      algorithms: ['RS256'],
      requiredClaims: ['exp', 'iat', 'sub', 'nonce'],
      // How far this server's clock and ORCID's may disagree
      clockTolerance: '2 minutes',
    })
    payload = result.payload
  } catch (error) {
    console.warn("ORCID's ID token didn't check out:", error)
    throw new SignInError(UNCHECKED_REPLY)
  }
  if (typeof payload.nonce !== 'string' || !sameSecret(payload.nonce, nonce)) {
    console.warn("ORCID's ID token has the wrong nonce")
    throw new SignInError(UNCHECKED_REPLY)
  }
  const orcid = String(payload.sub)
  if (!isValidOrcid(orcid)) {
    throw new SignInError(UNCHECKED_REPLY)
  }
  const parts = [payload.given_name, payload.family_name].filter(
    (part): part is string => typeof part === 'string' && part !== '',
  )
  return { orcid, name: parts.length > 0 ? parts.join(' ') : null }
}
