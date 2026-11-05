import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

import { SECURITY_HEADERS, withSecurityHeaders } from '../src/security-headers.ts'

describe('security headers', () => {
  it('are the same for the API as for the website’s files', async () => {
    const file = await readFile(new URL('../../frontend/public/_headers', import.meta.url), 'utf8')
    const fromFile = Object.fromEntries(
      file
        .split('\n')
        .filter((line) => line.startsWith('  '))
        .map((line) => {
          const separator = line.indexOf(':')
          return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()]
        }),
    )

    expect(fromFile).toEqual(SECURITY_HEADERS)
  })

  it('are added to a response, keeping its status and its own headers', () => {
    const response = withSecurityHeaders(
      Response.json({ ok: true }, { status: 201, headers: { 'X-Mine': 'yes' } }),
    )

    expect(response.status).toBe(201)
    expect(response.headers.get('X-Mine')).toBe('yes')
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
  })
})
