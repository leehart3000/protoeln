import { describe, expect, it } from 'vitest'

import { versionHash, type VersionHashInput } from '../../src/integrity/version-hash.ts'

const first: VersionHashInput = {
  entryId: '6560a1b2c3d4e5f6a7b8c9d0',
  number: 1,
  title: 'Western blot',
  contentFormat: 'protoeln-doc/1',
  content: { type: 'doc', content: [] },
  note: '',
  createdBy: '6560a1b2c3d4e5f6a7b8c9d1',
  createdAt: '2026-11-03T12:00:00.000Z',
  previousHash: null,
}

describe('versionHash', () => {
  it('is a SHA-256 hash, written as 64 hexadecimal characters', () => {
    expect(versionHash(first)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is the same for the same version, however its content keys are ordered', () => {
    const reordered = { ...first, content: { content: [], type: 'doc' } }

    expect(versionHash(reordered)).toBe(versionHash(first))
  })

  it('changes if anything it protects changes', () => {
    const original = versionHash(first)

    expect(versionHash({ ...first, title: 'Western blot (repeat)' })).not.toBe(original)
    expect(versionHash({ ...first, content: { type: 'doc', content: [1] } })).not.toBe(original)
    expect(versionHash({ ...first, createdAt: '2026-11-03T12:00:01.000Z' })).not.toBe(original)
  })

  it('chains each version to the one before', () => {
    const second = { ...first, number: 2, previousHash: versionHash(first) }
    const secondAfterTampering = {
      ...second,
      previousHash: versionHash({ ...first, title: 'Changed later' }),
    }

    expect(versionHash(secondAfterTampering)).not.toBe(versionHash(second))
  })
})
