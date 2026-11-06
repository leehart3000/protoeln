import { isValidOrcid } from './data/orcid.ts'

// Settings, from environment variables. Locally they can also come from backend/.env, which git
// ignores, so secrets (the ORCID client secret, the database password) are never committed.
// backend/.env.example lists them all.

export interface OrcidSettings {
  // https://sandbox.orcid.org for development, https://orcid.org for production
  baseUrl: string
  clientId: string
  clientSecret: string
}

export interface Config {
  // The port the API listens on
  port: number
  // The website's address, as people see it. Sign-in sends people back here, and cookies are
  // marked Secure when it starts with https://
  publicUrl: string
  mongodbUri: string | undefined
  mongodbDatabase: string
  // Sign-in with ORCID is off until a client ID and secret are set
  orcid: OrcidSettings | null
  // How long someone stays signed in
  sessionDays: number
  // People who are site admins, by ORCID iD (in addition to any marked so in the database)
  siteAdmins: string[]
  // The read-only lock: when on, nothing can be changed through the API (see docs/read-only.md)
  readOnly: boolean
}

export function readConfig(env: Record<string, string | undefined> = process.env): Config {
  const clientId = env.PROTOELN_ORCID_CLIENT_ID
  const clientSecret = env.PROTOELN_ORCID_CLIENT_SECRET
  const siteAdmins = (env.PROTOELN_SITE_ADMINS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id !== '')
  for (const id of siteAdmins) {
    if (!isValidOrcid(id)) {
      throw new Error(`PROTOELN_SITE_ADMINS: ${id} is not a valid ORCID iD`)
    }
  }
  const readOnly = env.PROTOELN_READ_ONLY ?? 'false'
  if (readOnly !== 'true' && readOnly !== 'false') {
    throw new Error('PROTOELN_READ_ONLY must be true or false')
  }
  const sessionDays = Number(env.PROTOELN_SESSION_DAYS ?? 14)
  if (!Number.isInteger(sessionDays) || sessionDays < 1 || sessionDays > 90) {
    throw new Error('PROTOELN_SESSION_DAYS must be a whole number of days from 1 to 90')
  }

  return {
    port: Number(env.PORT ?? 3000),
    publicUrl: (env.PROTOELN_PUBLIC_URL ?? 'http://127.0.0.1:5174').replace(/\/+$/, ''),
    mongodbUri: env.PROTOELN_MONGODB_URI,
    mongodbDatabase: env.PROTOELN_MONGODB_DATABASE ?? 'protoeln',
    orcid:
      clientId && clientSecret
        ? {
            baseUrl: (env.PROTOELN_ORCID_BASE_URL ?? 'https://sandbox.orcid.org').replace(
              /\/+$/,
              '',
            ),
            clientId,
            clientSecret,
          }
        : null,
    sessionDays,
    siteAdmins,
    readOnly: readOnly === 'true',
  }
}
