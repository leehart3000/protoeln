import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

// A long random value that can't be guessed, for session cookies and sign-in states
export function randomToken(): string {
  return randomBytes(32).toString('base64url')
}

// Only hashes of tokens are stored, so a copy of the database can't be used to sign in
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// Compares two secrets in a time that doesn't depend on where they differ
export function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
