import { describe, expect, it } from 'vitest'

import { linkTarget, linkToAddress, linkToEntry } from '../records'

describe('links to records', () => {
  it('recognises the records at ProtoLIMS-style addresses, on any site', () => {
    expect(linkToAddress('https://lims.example.org/samples/S-0042', 'Sample S-0042')).toEqual({
      system: 'lims.example.org',
      kind: 'sample',
      url: 'https://lims.example.org/samples/S-0042',
      label: 'Sample S-0042',
      externalId: 'S-0042',
    })
    expect(linkToAddress('https://protolims.org/projects/TCGA/studies/BRCA', '')).toMatchObject({
      kind: 'study',
      externalId: 'BRCA',
      label: 'https://protolims.org/projects/TCGA/studies/BRCA',
    })
    expect(linkToAddress('https://example.org/things/1', 'A thing')).toMatchObject({
      system: 'example.org',
      kind: 'record',
    })
    expect(linkToAddress('javascript:alert(1)', 'Click me')).toBeUndefined()
    expect(linkToAddress('not an address', '')).toBeUndefined()
  })

  it('says what a link is to', () => {
    expect(linkTarget(linkToEntry({ code: 'ELN-2026-0003', title: 'Lysate prep' }))).toBe(
      'entry ELN-2026-0003',
    )
    expect(linkTarget(linkToAddress('https://protolims.org/assays/A-1', 'Assay')!)).toBe(
      'assay on protolims.org',
    )
    expect(linkTarget(linkToAddress('https://example.org/x', 'X')!)).toBe('on example.org')
  })
})
