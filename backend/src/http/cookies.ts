import type { Request } from 'express'

export const SESSION_COOKIE = 'protoeln_session'
export const SIGN_IN_COOKIE = 'protoeln_sign_in'

// One cookie's value from the request, if it was sent
export function readCookie(req: Request, name: string): string | undefined {
  for (const pair of (req.headers.cookie ?? '').split(';')) {
    const separator = pair.indexOf('=')
    if (separator > 0 && pair.slice(0, separator).trim() === name) {
      return decodeURIComponent(pair.slice(separator + 1).trim())
    }
  }
  return undefined
}
