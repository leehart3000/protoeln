import { describe, expect, it } from 'vitest'

import { toMarkdown } from '../src/index.ts'
import { example } from './example.ts'

describe('toMarkdown', () => {
  it('writes every kind of block and mark as Markdown', () => {
    expect(toMarkdown(example)).toBe(
      [
        '## Aim',
        'Measure **p53** in _H_<sub>2</sub>_O_  \nSee `run_01.csv` and [the protocol](https://example.org/p) (10<sup>-3</sup> M, 2 \\* 3 \\#1)',
        '- Control\n- Treated',
        '3. Lyse',
        '> Keep on ice.',
        '```\nx = 1\ny = 2\n```',
        '| Lane | Band |\n| --- | --- |\n| 1 | a\\|b |',
        '[Data: D1]',
        '[File: Gel photo]',
        '- [x] Transfer to membrane',
        '- [ ] Block',
        '| Material | Supplier | Catalogue number | Lot number | Amount |\n' +
          '| --- | --- | --- | --- | --- |\n' +
          '| Anti-p53 | Acme | AB-1 | L42 | 1:1000 |\n' +
          '| Milk powder |  |  |  |  |',
        '[Sample S-1](https://protolims.org/s/1)',
      ].join('\n\n'),
    )
  })

  it('indents the later lines of a list item to keep them in the item', () => {
    expect(
      toMarkdown({
        type: 'doc',
        content: [
          {
            type: 'orderedList',
            content: [
              {
                type: 'listItem',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
                  { type: 'paragraph', content: [{ type: 'text', text: 'More' }] },
                ],
              },
            ],
          },
          {
            type: 'blockquote',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'One' }] },
              { type: 'paragraph', content: [{ type: 'text', text: 'Two' }] },
            ],
          },
        ],
      }),
    ).toBe('1. First\n\n   More\n\n> One\n>\n> Two')
  })

  it('names a file by its id when it has no caption, and pads short table rows', () => {
    expect(
      toMarkdown({
        type: 'doc',
        content: [
          { type: 'fileBlock', attrs: { fileId: 'F2' } },
          { type: 'codeBlock' },
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  { type: 'tableHeader', content: [{ type: 'paragraph' }] },
                  { type: 'tableHeader', content: [{ type: 'paragraph' }] },
                ],
              },
              {
                type: 'tableRow',
                content: [{ type: 'tableCell', content: [{ type: 'paragraph' }] }],
              },
            ],
          },
        ],
      }),
    ).toBe('[File: F2]\n\n```\n\n```\n\n|  |  |\n| --- | --- |\n|  |  |')
  })
})
