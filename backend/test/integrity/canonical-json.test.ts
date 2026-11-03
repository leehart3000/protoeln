import { describe, expect, it } from 'vitest'

import { canonicalJson } from '../../src/integrity/canonical-json.ts'

describe('canonicalJson', () => {
  it('sorts object keys, at every level', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { f: 1, e: 2 }], c: 'x' } })).toBe(
      '{"a":{"c":"x","d":[3,{"e":2,"f":1}]},"b":1}',
    )
  })

  it('gives the same text whatever order the keys were written in', () => {
    expect(canonicalJson({ title: 'T', number: 1 })).toBe(canonicalJson({ number: 1, title: 'T' }))
  })

  it('keeps array order, and null, booleans and strings as JSON', () => {
    expect(canonicalJson([null, true, false, 'a "quoted" word', 2.5])).toBe(
      '[null,true,false,"a \\"quoted\\" word",2.5]',
    )
  })

  it('leaves out properties that are undefined', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}')
  })

  it.each([NaN, Infinity])('refuses %s, which JSON cannot represent', (value) => {
    expect(() => canonicalJson(value)).toThrow(TypeError)
  })

  it('refuses dates and other non-plain objects, which must be converted first', () => {
    expect(() => canonicalJson({ createdAt: new Date() })).toThrow(TypeError)
  })
})
