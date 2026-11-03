import { describe, expect, it } from 'vitest'

import { checkDocument, isDocument } from '../src/index.ts'
import { example } from './example.ts'

describe('checkDocument', () => {
  it('finds no problems in a valid document using every kind of block and mark', () => {
    expect(checkDocument(example)).toEqual([])
    expect(isDocument(example)).toBe(true)
  })

  it('accepts an empty document', () => {
    expect(checkDocument({ type: 'doc', content: [] })).toEqual([])
  })

  it('refuses something that is not a document at all', () => {
    expect(checkDocument({ type: 'paragraph' })).toEqual([
      { path: '', message: 'should be a document ({ "type": "doc", "content": [...] })' },
    ])
    expect(checkDocument(null)).toHaveLength(1)
    expect(isDocument('text')).toBe(false)
  })

  it('lists every problem it finds, each with where it is', () => {
    const problems = checkDocument({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 4 } },
        { type: 'paragraph', content: [{ type: 'text', text: '' }] },
        { type: 'video' },
        { type: 'bulletList', content: [] },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: {} }] }],
        },
      ],
    })

    expect(problems.map((problem) => problem.path)).toEqual([
      'content[0].attrs.level',
      'content[1].content[0].text',
      'content[2].type',
      'content[3].content',
      'content[4].content[0].marks[0].attrs.href',
    ])
  })

  it.each([
    ['a missing content list', { type: 'doc' }, 'content'],
    ['a block that is not an object', { type: 'doc', content: ['text'] }, 'content[0]'],
    [
      'an unknown mark',
      {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'glow' }] }] },
        ],
      },
      'content[0].content[0].marks[0].type',
    ],
    [
      'an ordered list starting at a fraction',
      {
        type: 'doc',
        content: [
          {
            type: 'orderedList',
            attrs: { start: 1.5 },
            content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
          },
        ],
      },
      'content[0].attrs.start',
    ],
    [
      'a protocol step without done',
      { type: 'doc', content: [{ type: 'protocolStep', attrs: {} }] },
      'content[0].attrs.done',
    ],
    [
      'a material without a name',
      { type: 'doc', content: [{ type: 'materials', attrs: { items: [{ lotNumber: 'L1' }] } }] },
      'content[0].attrs.items[0].name',
    ],
    [
      'a material that is not an object',
      { type: 'doc', content: [{ type: 'materials', attrs: { items: ['Milk'] } }] },
      'content[0].attrs.items[0]',
    ],
    [
      'a record link without a URL',
      {
        type: 'doc',
        content: [{ type: 'recordLink', attrs: { system: 's', kind: 'k', label: 'l' } }],
      },
      'content[0].attrs.url',
    ],
    [
      'a data block without attributes',
      { type: 'doc', content: [{ type: 'dataBlock' }] },
      'content[0].attrs',
    ],
    [
      'a file caption that is not text',
      { type: 'doc', content: [{ type: 'fileBlock', attrs: { fileId: 'F1', caption: 3 } }] },
      'content[0].attrs.caption',
    ],
    [
      'a table row with no cells',
      { type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: [] }] }] },
      'content[0].content[0].content',
    ],
    [
      'formatting inside a code block',
      {
        type: 'doc',
        content: [{ type: 'codeBlock', content: [{ type: 'hardBreak' }] }],
      },
      'content[0].content[0].type',
    ],
  ])('reports %s', (_description, document, path) => {
    expect(checkDocument(document).map((problem) => problem.path)).toContain(path)
  })
})
