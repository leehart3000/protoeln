import { describe, expect, it } from 'vitest'

import { checkDocument } from '../src/check.ts'
import { fromProseMirror } from '../src/prosemirror.ts'
import { example } from './example.ts'

describe('fromProseMirror', () => {
  it('keeps a document in the format exactly as it is', () => {
    expect(fromProseMirror(example)).toEqual(example)
  })

  it('leaves out what an editor adds that the format does not hold', () => {
    const fromEditor = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2, textAlign: null },
          content: [{ type: 'text', text: 'Aim' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: null },
          content: [
            {
              type: 'text',
              text: 'link',
              marks: [
                {
                  type: 'link',
                  attrs: { href: 'https://example.org', target: '_blank', rel: null, class: null },
                },
              ],
            },
          ],
        },
        { type: 'orderedList', attrs: { start: 1, type: null }, content: [] },
        { type: 'orderedList', attrs: { start: 3, type: null }, content: [] },
        {
          type: 'codeBlock',
          attrs: { language: null },
          content: [{ type: 'text', text: 'x = 1' }],
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableHeader',
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                  content: [{ type: 'paragraph' }],
                },
              ],
            },
          ],
        },
        {
          type: 'protocolStep',
          attrs: { done: false, doneBy: null, doneAt: null },
          content: [{ type: 'text', text: 'Mix' }],
        },
        { type: 'fileBlock', attrs: { fileId: 'f1', caption: null } },
        { type: 'paragraph' },
        { type: 'paragraph', content: [] },
      ],
    }

    expect(fromProseMirror(fromEditor)).toEqual({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Aim' }] },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'link',
              marks: [{ type: 'link', attrs: { href: 'https://example.org' } }],
            },
          ],
        },
        { type: 'orderedList', content: [] },
        { type: 'orderedList', attrs: { start: 3 }, content: [] },
        { type: 'codeBlock', content: [{ type: 'text', text: 'x = 1' }] },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [{ type: 'tableHeader', content: [{ type: 'paragraph' }] }],
            },
          ],
        },
        {
          type: 'protocolStep',
          attrs: { done: false },
          content: [{ type: 'text', text: 'Mix' }],
        },
        { type: 'fileBlock', attrs: { fileId: 'f1' } },
      ],
    })
  })

  it('makes a document that is only an empty paragraph an empty document', () => {
    expect(fromProseMirror({ type: 'doc', content: [{ type: 'paragraph' }] })).toEqual({
      type: 'doc',
      content: [],
    })
  })

  it('passes on anything the format does not know, so checking reports it', () => {
    const doc = fromProseMirror({
      type: 'doc',
      content: [
        { type: 'horizontalRule' },
        { type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'strike' }] }] },
      ],
    })

    expect(checkDocument(doc).map((problem) => problem.path)).toEqual([
      'content[0].type',
      'content[1].content[0].marks[0].type',
    ])
  })
})
