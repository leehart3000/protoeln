import type { DocNode, ProtocolStepNode } from './types.ts'

// Finds every protocol step in a document, however deep (in a list, a quote or a table cell),
// in reading order. Each comes with its path: the position of each node on the way down, so
// [2, 0, 1] is doc.content[2].content[0].content[1]. A path names one step in one saved draft,
// so whoever uses it should check the draft hasn't changed since (see `basedOn` in the API).

export interface StepAt {
  path: number[]
  step: ProtocolStepNode
}

export function stepsOf(doc: DocNode): StepAt[] {
  const found: StepAt[] = []
  const walk = (nodes: unknown, path: number[]) => {
    if (!Array.isArray(nodes)) return
    nodes.forEach((node: unknown, index) => {
      if (typeof node !== 'object' || node === null) return
      const at = [...path, index]
      const { type, content } = node as { type?: unknown; content?: unknown }
      if (type === 'protocolStep') {
        found.push({ path: at, step: node as ProtocolStepNode })
      } else {
        walk(content, at)
      }
    })
  }
  walk(doc.content, [])
  return found
}

// A path as checkDocument writes locations, e.g. "content[2].content[0].content[1]"
export function pathText(path: number[]): string {
  return path.map((index) => `content[${index}]`).join('.')
}
