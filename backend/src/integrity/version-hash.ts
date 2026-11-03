import { createHash } from 'node:crypto'

import { canonicalJson } from './canonical-json.ts'

// Everything about an entry version that its hash protects. Including the previous version's
// hash chains the versions together: changing any stored version would change its hash, which
// would no longer match the previousHash recorded in the version after it.
export interface VersionHashInput {
  entryId: string
  number: number
  title: string
  contentFormat: string
  content: unknown
  note: string
  createdBy: string
  createdAt: string
  previousHash: string | null
}

export function versionHash(input: VersionHashInput): string {
  return createHash('sha256').update(canonicalJson(input)).digest('hex')
}
