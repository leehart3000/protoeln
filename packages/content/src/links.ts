import type { DocNode, RecordLinkNode } from './types.ts'

// Links to records (recordLink blocks), wherever they are in a document (in a list, a quote or
// a table cell), in reading order.
export function recordLinksOf(doc: DocNode): RecordLinkNode[] {
  const found: RecordLinkNode[] = []
  const walk = (nodes: unknown) => {
    if (!Array.isArray(nodes)) return
    for (const node of nodes as unknown[]) {
      if (typeof node !== 'object' || node === null) continue
      const { type, content } = node as { type?: unknown; content?: unknown }
      if (type === 'recordLink') {
        found.push(node as RecordLinkNode)
      } else {
        walk(content)
      }
    }
  }
  walk(doc.content)
  return found
}

// The codes of the ProtoELN entries a document links to, each once, in reading order
export function linkedEntryCodes(doc: DocNode): string[] {
  const codes = recordLinksOf(doc)
    .filter(({ attrs }) => attrs.system === 'protoeln' && attrs.kind === 'entry')
    .flatMap(({ attrs }) => attrs.externalId ?? [])
  return [...new Set(codes)]
}
