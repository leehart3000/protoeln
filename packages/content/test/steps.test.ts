import { describe, expect, it } from 'vitest'

import { pathText, stepsOf } from '../src/steps.ts'
import type { DocNode } from '../src/types.ts'

function step(text: string, done = false) {
  return {
    type: 'protocolStep' as const,
    attrs: { done },
    content: [{ type: 'text' as const, text }],
  }
}

describe('stepsOf', () => {
  it('finds every protocol step, however deep, in reading order', () => {
    const doc: DocNode = {
      type: 'doc',
      content: [
        step('Thaw the samples'),
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [step('Spin down', true)] }],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'Then:' }] },
        {
          type: 'table',
          content: [
            { type: 'tableRow', content: [{ type: 'tableCell', content: [step('Load the gel')] }] },
          ],
        },
      ],
    }

    expect(stepsOf(doc).map(({ path, step }) => [path, step.content?.[0]])).toEqual([
      [[0], { type: 'text', text: 'Thaw the samples' }],
      [[1, 0, 0], { type: 'text', text: 'Spin down' }],
      [[3, 0, 0, 0], { type: 'text', text: 'Load the gel' }],
    ])
  })

  it('finds nothing in a document without steps, and writes paths as checking does', () => {
    expect(stepsOf({ type: 'doc', content: [] })).toEqual([])
    expect(pathText([1, 0, 0])).toBe('content[1].content[0].content[0]')
  })
})
