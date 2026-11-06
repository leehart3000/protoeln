import { describe, expect, it } from 'vitest'

import { fileIdsOf, linkedEntryCodes, recordLinksOf } from '../src/links.ts'
import type { DocNode } from '../src/types.ts'

function entryLink(code: string) {
  return {
    type: 'recordLink' as const,
    attrs: {
      system: 'protoeln',
      kind: 'entry',
      url: `/entries/${code}`,
      label: 'An entry',
      externalId: code,
    },
  }
}

const sample = {
  type: 'recordLink' as const,
  attrs: {
    system: 'protolims.org',
    kind: 'sample',
    url: 'https://protolims.org/samples/S-0042',
    label: 'Sample S-0042',
    externalId: 'S-0042',
  },
}

const doc: DocNode = {
  type: 'doc',
  content: [
    entryLink('ELN-2026-0002'),
    { type: 'blockquote', content: [sample, entryLink('ELN-2026-0003')] },
    {
      type: 'bulletList',
      content: [{ type: 'listItem', content: [entryLink('ELN-2026-0002')] }],
    },
  ],
}

describe('links to records', () => {
  it('finds every link to a record, however deep, in reading order', () => {
    expect(recordLinksOf(doc).map(({ attrs }) => attrs.externalId)).toEqual([
      'ELN-2026-0002',
      'S-0042',
      'ELN-2026-0003',
      'ELN-2026-0002',
    ])
  })

  it('lists the entries a document links to, each once', () => {
    expect(linkedEntryCodes(doc)).toEqual(['ELN-2026-0002', 'ELN-2026-0003'])
    expect(linkedEntryCodes({ type: 'doc', content: [sample] })).toEqual([])
  })
})

describe('fileIdsOf', () => {
  it('lists the files a document shows, each once, wherever they are', () => {
    const file = (fileId: string) => ({ type: 'fileBlock' as const, attrs: { fileId } })
    const doc: DocNode = {
      type: 'doc',
      content: [
        file('a1'),
        { type: 'blockquote', content: [file('b2')] },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [{ type: 'tableCell', content: [file('a1'), file('c3')] }],
            },
          ],
        },
      ],
    }

    expect(fileIdsOf(doc)).toEqual(['a1', 'b2', 'c3'])
  })
})
