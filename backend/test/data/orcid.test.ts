import { describe, it, expect } from 'vitest'

import { isValidOrcid } from '../../src/data/orcid.ts'

describe('isValidOrcid', () => {
  it('accepts a valid ORCID iD', () => {
    // ORCID's own example iD (Josiah Carberry)
    expect(isValidOrcid('0000-0002-1825-0097')).toBe(true)
  })

  it('accepts a check character of X', () => {
    expect(isValidOrcid('0000-0002-1694-233X')).toBe(true)
  })

  it('rejects a wrong check digit', () => {
    expect(isValidOrcid('0000-0002-1825-0098')).toBe(false)
  })

  it.each(['', '0000000218250097', '0000-0002-1825-009', 'https://orcid.org/0000-0002-1825-0097'])(
    'rejects %j, which is not in the form 0000-0000-0000-0000',
    (id) => {
      expect(isValidOrcid(id)).toBe(false)
    },
  )
})
