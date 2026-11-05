import type { DocNode } from '../src/types.ts'

// A small entry that uses every kind of block and mark
export const example: DocNode = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Aim' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Measure ' },
        { type: 'text', text: 'p53', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' in ' },
        { type: 'text', text: 'H', marks: [{ type: 'italic' }] },
        { type: 'text', text: '2', marks: [{ type: 'subscript' }] },
        { type: 'text', text: 'O', marks: [{ type: 'italic' }] },
        { type: 'hardBreak' },
        { type: 'text', text: 'See ' },
        { type: 'text', text: 'run_01.csv', marks: [{ type: 'code' }] },
        { type: 'text', text: ' and ' },
        {
          type: 'text',
          text: 'the protocol',
          marks: [{ type: 'link', attrs: { href: 'https://example.org/p' } }],
        },
        { type: 'text', text: ' (10' },
        { type: 'text', text: '-3', marks: [{ type: 'superscript' }] },
        { type: 'text', text: ' M, 2 * 3 #1)' },
      ],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Control' }] }],
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Treated' }] }],
        },
      ],
    },
    {
      type: 'orderedList',
      attrs: { start: 3 },
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Lyse' }] }],
        },
      ],
    },
    {
      type: 'blockquote',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Keep on ice.' }] }],
    },
    { type: 'codeBlock', content: [{ type: 'text', text: 'x = 1\ny = 2' }] },
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableHeader',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Lane' }] }],
            },
            {
              type: 'tableHeader',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Band' }] }],
            },
          ],
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: '1' }] }],
            },
            {
              type: 'tableCell',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a|b' }] }],
            },
          ],
        },
      ],
    },
    { type: 'dataBlock', attrs: { dataItemId: 'D1' } },
    { type: 'fileBlock', attrs: { fileId: 'F1', caption: 'Gel photo' } },
    {
      type: 'protocolStep',
      attrs: { done: true, doneBy: '0000-0002-1825-0097', doneAt: '2026-11-03T12:00:00Z' },
      content: [{ type: 'text', text: 'Transfer to membrane' }],
    },
    { type: 'protocolStep', attrs: { done: false }, content: [{ type: 'text', text: 'Block' }] },
    {
      type: 'materials',
      attrs: {
        items: [
          {
            name: 'Anti-p53',
            supplier: 'Acme',
            catalogueNumber: 'AB-1',
            lotNumber: 'L42',
            amount: '1:1000',
          },
          { name: 'Milk powder' },
        ],
      },
    },
    {
      type: 'recordLink',
      attrs: {
        system: 'protolims',
        kind: 'sample',
        url: 'https://protolims.org/s/1',
        label: 'Sample S-1',
      },
    },
  ],
}
