import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { nextEntryCode, nextValue } from '../../src/data/models/counter.ts'
import { clearDatabase, startDatabase, stopDatabase } from '../database.ts'

beforeAll(startDatabase)
afterEach(clearDatabase)
afterAll(stopDatabase)

describe('nextValue', () => {
  it('counts up from 1, separately for each counter', async () => {
    expect(await nextValue('a')).toBe(1)
    expect(await nextValue('a')).toBe(2)
    expect(await nextValue('b')).toBe(1)
  })

  it('never gives the same number twice, even at the same moment', async () => {
    const values = await Promise.all(Array.from({ length: 20 }, () => nextValue('a')))

    expect(new Set(values).size).toBe(20)
  })
})

describe('nextEntryCode', () => {
  it('numbers entries within each year', async () => {
    const in2026 = new Date('2026-11-03T12:00:00Z')
    const in2027 = new Date('2027-01-01T00:00:00Z')

    expect(await nextEntryCode(in2026)).toBe('ELN-2026-0001')
    expect(await nextEntryCode(in2026)).toBe('ELN-2026-0002')
    expect(await nextEntryCode(in2027)).toBe('ELN-2027-0001')
  })
})
