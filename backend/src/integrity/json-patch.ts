// JSON Patch (RFC 6902): a standard way to describe changes to a JSON document as a list of
// operations. Each save records the patch that turns the previous draft into the new one, so the
// audit trail shows exactly what changed without storing a full copy on every save.

export type Operation =
  | { op: 'add'; path: string; value: unknown }
  | { op: 'remove'; path: string }
  | { op: 'replace'; path: string; value: unknown }

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

// "/" and "~" in object keys are written as "~1" and "~0" in paths
function pathPart(key: string | number): string {
  return String(key).replaceAll('~', '~0').replaceAll('/', '~1')
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// The operations that turn `before` into `after`, or none if they are equal
export function diffJson(before: unknown, after: unknown, path = ''): Operation[] {
  if (Array.isArray(before) && Array.isArray(after)) {
    const operations: Operation[] = []
    const shared = Math.min(before.length, after.length)
    for (let index = 0; index < shared; index++) {
      operations.push(...diffJson(before[index], after[index], `${path}/${index}`))
    }
    // Remove from the end first, so earlier positions don't shift
    for (let index = before.length - 1; index >= shared; index--) {
      operations.push({ op: 'remove', path: `${path}/${index}` })
    }
    for (let index = shared; index < after.length; index++) {
      operations.push({ op: 'add', path: `${path}/${index}`, value: after[index] })
    }
    return operations
  }
  if (isPlainObject(before) && isPlainObject(after)) {
    const operations: Operation[] = []
    for (const key of Object.keys(before)) {
      if (!Object.hasOwn(after, key)) {
        operations.push({ op: 'remove', path: `${path}/${pathPart(key)}` })
      }
    }
    for (const [key, value] of Object.entries(after)) {
      const child = `${path}/${pathPart(key)}`
      if (!Object.hasOwn(before, key)) {
        operations.push({ op: 'add', path: child, value })
      } else {
        operations.push(...diffJson(before[key], value, child))
      }
    }
    return operations
  }
  if (Object.is(before, after)) {
    return []
  }
  return [{ op: 'replace', path, value: after }]
}

function parsePath(path: string): string[] {
  return path
    .split('/')
    .slice(1)
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
}

// Applies operations to a copy of `document`, returning the result. Used to rebuild earlier
// drafts from the audit trail, and to check that recorded changes are complete.
export function applyJsonPatch(document: unknown, operations: Operation[]): unknown {
  let result = structuredClone(document) as Json
  for (const operation of operations) {
    const parts = parsePath(operation.path)
    if (parts.length === 0) {
      if (operation.op === 'remove') {
        throw new Error('Cannot remove the whole document')
      }
      result = structuredClone(operation.value) as Json
      continue
    }
    let parent: Json = result
    for (const part of parts.slice(0, -1)) {
      parent = (
        Array.isArray(parent) ? parent[Number(part)] : (parent as Record<string, Json>)[part]
      ) as Json
    }
    const last = parts.at(-1) as string
    const value = 'value' in operation ? (structuredClone(operation.value) as Json) : null
    if (Array.isArray(parent)) {
      const index = Number(last)
      if (operation.op === 'add') {
        parent.splice(index, 0, value)
      } else if (operation.op === 'remove') {
        parent.splice(index, 1)
      } else {
        parent[index] = value
      }
    } else if (isPlainObject(parent)) {
      if (operation.op === 'remove') {
        delete parent[last]
      } else {
        parent[last] = value
      }
    } else {
      throw new Error(`Cannot apply ${operation.op} at ${operation.path}`)
    }
  }
  return result
}
