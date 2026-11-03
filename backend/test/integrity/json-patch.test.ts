import { describe, expect, it } from 'vitest'

import { applyJsonPatch, diffJson } from '../../src/integrity/json-patch.ts'

describe('diffJson', () => {
  it('finds nothing to change between equal values', () => {
    expect(diffJson({ a: [1, { b: 'x' }] }, { a: [1, { b: 'x' }] })).toEqual([])
  })

  it('describes changed, added and removed values with their paths', () => {
    expect(
      diffJson({ a: 1, b: [1, 2, 3], c: { d: 'x' } }, { a: 2, b: [1, 5], c: { d: 'x', e: null } }),
    ).toEqual([
      { op: 'replace', path: '/a', value: 2 },
      { op: 'replace', path: '/b/1', value: 5 },
      { op: 'remove', path: '/b/2' },
      { op: 'add', path: '/c/e', value: null },
    ])
  })

  it('removes from the end of a list first, so positions do not shift', () => {
    expect(diffJson([1, 2, 3], [1])).toEqual([
      { op: 'remove', path: '/2' },
      { op: 'remove', path: '/1' },
    ])
  })

  it('writes "/" and "~" in keys as "~1" and "~0"', () => {
    expect(diffJson({}, { 'a/b~c': 1 })).toEqual([{ op: 'add', path: '/a~1b~0c', value: 1 }])
  })

  it('replaces the whole value when its kind changes', () => {
    expect(diffJson({ a: [1] }, 'text')).toEqual([{ op: 'replace', path: '', value: 'text' }])
  })
})

describe('applyJsonPatch', () => {
  it.each([
    [
      { a: 1, b: [1, 2, 3], c: { d: 'x' } },
      { a: 2, b: [1, 5], c: { d: 'x', e: null }, 'f/g~': 1 },
    ],
    [
      [1, 2],
      [1, 2, 3, 4],
    ],
    [{ x: [{ y: 1 }] }, { x: [] }],
    [1, 'a'],
    [
      { title: 'T', content: { type: 'doc', content: [{ type: 'paragraph' }] } },
      {
        title: 'T2',
        content: {
          type: 'doc',
          content: [{ type: 'heading', attrs: { level: 1 } }, { type: 'paragraph' }],
        },
      },
    ],
  ])('turns %j back into %j using the recorded changes', (before, after) => {
    expect(applyJsonPatch(before, diffJson(before, after))).toEqual(after)
  })

  it('leaves the original unchanged', () => {
    const original = { a: [1, 2] }

    applyJsonPatch(original, [{ op: 'remove', path: '/a/0' }])

    expect(original).toEqual({ a: [1, 2] })
  })

  it('refuses to remove the whole document, or to change inside a plain value', () => {
    expect(() => applyJsonPatch({}, [{ op: 'remove', path: '' }])).toThrow()
    expect(() => applyJsonPatch({ a: 1 }, [{ op: 'add', path: '/a/b', value: 2 }])).toThrow()
  })
})
