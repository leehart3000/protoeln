import { describe, expect, it } from 'vitest'

import { readConfig } from '../src/config.ts'

describe('readConfig', () => {
  it('has development defaults, with sign-in off', () => {
    expect(readConfig({})).toEqual({
      port: 3000,
      publicUrl: 'http://127.0.0.1:5174',
      mongodbUri: undefined,
      mongodbDatabase: 'protoeln',
      orcid: null,
      sessionDays: 14,
      siteAdmins: [],
    })
  })

  it('reads every setting', () => {
    const config = readConfig({
      PORT: '8080',
      PROTOELN_PUBLIC_URL: 'https://protoeln.org/',
      PROTOELN_MONGODB_URI: 'mongodb+srv://example',
      PROTOELN_MONGODB_DATABASE: 'protoeln-dev',
      PROTOELN_ORCID_BASE_URL: 'https://orcid.org',
      PROTOELN_ORCID_CLIENT_ID: 'APP-1',
      PROTOELN_ORCID_CLIENT_SECRET: 'secret',
      PROTOELN_SESSION_DAYS: '7',
      PROTOELN_SITE_ADMINS: '0000-0002-1825-0097, 0000-0002-1694-233X',
    })

    expect(config.port).toBe(8080)
    expect(config.publicUrl).toBe('https://protoeln.org')
    expect(config.orcid).toEqual({
      baseUrl: 'https://orcid.org',
      clientId: 'APP-1',
      clientSecret: 'secret',
    })
    expect(config.sessionDays).toBe(7)
    expect(config.siteAdmins).toEqual(['0000-0002-1825-0097', '0000-0002-1694-233X'])
  })

  it('refuses an invalid site admin ORCID iD, or session length', () => {
    expect(() => readConfig({ PROTOELN_SITE_ADMINS: '1234' })).toThrow(/1234/)
    expect(() => readConfig({ PROTOELN_SESSION_DAYS: '0' })).toThrow(/SESSION_DAYS/)
  })
})
