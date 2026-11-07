import type { BlockNode, DocNode, InlineNode, Mark, Material } from './types.ts'

// Turns a document from a ProseMirror-based editor (such as Tiptap's getJSON()) into
// protoeln-doc/1. The two share their structure, but an editor adds things the format doesn't
// hold: attributes left at their defaults (a code block's language, a link's target, a table
// cell's colspan), nulls for optional attributes, and empty content lists. This keeps exactly
// what the format holds and nothing else, so what's stored doesn't depend on the editor.
//
// Empty paragraphs at the very end of the document are left off (see fromProseMirror).
//
// Anything the format doesn't know (a node or mark type it doesn't list) is passed through
// unchanged rather than dropped, so checkDocument reports it and nothing is lost unnoticed.

type Json = Record<string, unknown>

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function attrsOf(node: Json): Json {
  return isObject(node.attrs) ? node.attrs : {}
}

// The optional text attributes that are set (not null, undefined or missing)
function optionalText<K extends string>(attrs: Json, keys: readonly K[]) {
  const kept: Partial<Record<K, string>> = {}
  for (const key of keys) {
    const value = attrs[key]
    if (typeof value === 'string') {
      kept[key] = value
    }
  }
  return kept
}

// A table cell's colspan and rowspan, when either isn't 1. (Column widths aren't content, so
// they're left out, as are spans of 1.)
function spanOf(attrs: Json) {
  const span: Json = {}
  for (const key of ['colspan', 'rowspan']) {
    if (attrs[key] !== undefined && attrs[key] !== 1) {
      span[key] = attrs[key]
    }
  }
  return Object.keys(span).length > 0 ? span : undefined
}

function mark(value: unknown): Mark {
  if (!isObject(value)) return value as Mark
  switch (value.type) {
    case 'bold':
    case 'italic':
    case 'code':
    case 'subscript':
    case 'superscript':
      return { type: value.type }
    case 'link':
      return { type: 'link', attrs: { href: String(attrsOf(value).href ?? '') } }
    default:
      return value as unknown as Mark
  }
}

function inline(value: unknown): InlineNode {
  if (!isObject(value)) return value as InlineNode
  if (value.type === 'hardBreak') return { type: 'hardBreak' }
  if (value.type === 'text') {
    const marks = list(value.marks).map(mark)
    return marks.length > 0
      ? { type: 'text', text: String(value.text ?? ''), marks }
      : { type: 'text', text: String(value.text ?? '') }
  }
  return value as unknown as InlineNode
}

// Inline content, left out when there is none (as in an empty paragraph)
function withInline<T extends Json>(node: T, source: Json): T & { content?: InlineNode[] } {
  const content = list(source.content).map(inline)
  return content.length > 0 ? { ...node, content } : node
}

function blocks(value: unknown): BlockNode[] {
  return list(value).map(block)
}

function listItems(value: unknown) {
  return list(value).map((item) => {
    const node = isObject(item) ? item : {}
    return { type: 'listItem' as const, content: blocks(node.content) }
  })
}

function material(value: unknown): Material {
  const item = isObject(value) ? value : {}
  return {
    name: String(item.name ?? ''),
    ...optionalText(item, ['supplier', 'catalogueNumber', 'lotNumber', 'amount'] as const),
  }
}

function block(value: unknown): BlockNode {
  if (!isObject(value)) return value as BlockNode
  const attrs = attrsOf(value)
  switch (value.type) {
    case 'paragraph':
      return withInline({ type: 'paragraph' as const }, value)
    case 'heading':
      return withInline(
        { type: 'heading' as const, attrs: { level: attrs.level as 1 | 2 | 3 } },
        value,
      )
    case 'bulletList':
      return { type: 'bulletList', content: listItems(value.content) }
    case 'orderedList': {
      // Lists start at 1 unless they say otherwise
      const start = attrs.start
      return typeof start === 'number' && start !== 1
        ? { type: 'orderedList', attrs: { start }, content: listItems(value.content) }
        : { type: 'orderedList', content: listItems(value.content) }
    }
    case 'blockquote':
      return { type: 'blockquote', content: blocks(value.content) }
    case 'codeBlock': {
      const content = list(value.content).map((node) => {
        const text = inline(node)
        return text.type === 'text' ? { type: 'text' as const, text: text.text } : text
      })
      return content.length > 0
        ? { type: 'codeBlock', content: content as { type: 'text'; text: string }[] }
        : { type: 'codeBlock' }
    }
    case 'table':
      return {
        type: 'table',
        content: list(value.content).map((row) => ({
          type: 'tableRow' as const,
          content: list(isObject(row) ? row.content : []).map((cell) => {
            const node = isObject(cell) ? cell : {}
            const kept = {
              type: node.type === 'tableHeader' ? ('tableHeader' as const) : ('tableCell' as const),
              content: blocks(node.content),
            }
            // A merged cell keeps its span
            const span = spanOf(attrsOf(node))
            return span ? ({ ...kept, attrs: span } as typeof kept) : kept
          }),
        })),
      }
    case 'dataBlock':
      return { type: 'dataBlock', attrs: { dataItemId: String(attrs.dataItemId ?? '') } }
    case 'fileBlock':
      return {
        type: 'fileBlock',
        attrs: {
          fileId: String(attrs.fileId ?? ''),
          ...optionalText(attrs, ['caption', 'alt'] as const),
        },
      }
    case 'protocolStep':
      return withInline(
        {
          type: 'protocolStep' as const,
          attrs: {
            done: attrs.done === true,
            ...optionalText(attrs, ['doneBy', 'doneAt'] as const),
          },
        },
        value,
      )
    case 'materials':
      return { type: 'materials', attrs: { items: list(attrs.items).map(material) } }
    case 'recordLink':
      return {
        type: 'recordLink',
        attrs: {
          system: String(attrs.system ?? ''),
          kind: String(attrs.kind ?? ''),
          url: String(attrs.url ?? ''),
          label: String(attrs.label ?? ''),
          ...optionalText(attrs, ['externalId'] as const),
        },
      }
    default:
      return value as unknown as BlockNode
  }
}

function isEmptyParagraph(node: BlockNode) {
  return node.type === 'paragraph' && node.content === undefined
}

// Editors keep an empty paragraph at the end of a document, to type into. These are left off,
// as they hold nothing: an entry that is only empty paragraphs is an empty entry.
export function fromProseMirror(value: unknown): DocNode {
  const doc = isObject(value) ? value : {}
  const content = blocks(doc.content)
  while (content.length > 0 && isEmptyParagraph(content[content.length - 1]!)) {
    content.pop()
  }
  return { type: 'doc', content }
}
