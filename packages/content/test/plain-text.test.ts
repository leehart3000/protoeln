import { describe, expect, it } from 'vitest'

import { toPlainText } from '../src/index.ts'
import { example } from './example.ts'

describe('toPlainText', () => {
  it('keeps every word of text, without formatting, with blocks separated by blank lines', () => {
    expect(toPlainText(example)).toBe(
      [
        'Aim',
        'Measure p53 in H2O\nSee run_01.csv and the protocol (10-3 M, 2 * 3 #1), urgent',
        '- Control\n- Treated',
        '3. Lyse',
        'Keep on ice.',
        'x = 1\ny = 2',
        'Lane\tBand\n1\ta|b',
        '[Data: D1]',
        '[File: Gel photo]',
        '[x] Transfer to membrane',
        '[ ] Block',
        'Anti-p53, Acme, AB-1, L42, 1:1000\nMilk powder',
        'Sample S-1 (https://protolims.org/s/1)',
      ].join('\n\n'),
    )
  })

  it('names a file by its id when it has no caption', () => {
    expect(
      toPlainText({ type: 'doc', content: [{ type: 'fileBlock', attrs: { fileId: 'F2' } }] }),
    ).toBe('[File: F2]')
  })

  it('gives empty text for an empty document', () => {
    expect(toPlainText({ type: 'doc', content: [] })).toBe('')
  })
})
