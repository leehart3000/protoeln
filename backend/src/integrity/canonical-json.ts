// Canonical JSON: the same value always gives exactly the same text, whatever order its object
// keys were written in. Hashes are calculated from this text, so they don't depend on how a
// database or library happens to order keys. Keys are sorted, there is no white space, and
// object properties that are undefined are left out, as in JSON.stringify.

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Cannot represent ${String(value)} in JSON`)
    }
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    // Object keys are unique, so two keys are never equal when sorting
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`
  }
  // Dates, ObjectIds and other objects must be converted to plain values (e.g. strings) first,
  // so that what is hashed is always explicit
  throw new TypeError(`Cannot represent a ${typeof value} of this kind in canonical JSON`)
}
