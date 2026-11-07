// ProtoELN's entry content format, protoeln-doc/1 (see docs/content-format.md). It uses the
// document structure of ProseMirror, which the Tiptap editor is built on, but allows only the
// blocks and marks listed here, so that a different editor could replace Tiptap with one converter.

export const CONTENT_FORMAT = 'protoeln-doc/1'

// Inline content

export type Mark =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'code' }
  | { type: 'subscript' }
  | { type: 'superscript' }
  // Text marked out, as with a highlighter pen
  | { type: 'highlight' }
  | { type: 'link'; attrs: { href: string } }

export interface TextNode {
  type: 'text'
  text: string
  marks?: Mark[]
}

export interface HardBreakNode {
  type: 'hardBreak'
}

export type InlineNode = TextNode | HardBreakNode

// Blocks

export interface ParagraphNode {
  type: 'paragraph'
  content?: InlineNode[]
}

export interface HeadingNode {
  type: 'heading'
  attrs: { level: 1 | 2 | 3 }
  content?: InlineNode[]
}

export interface ListItemNode {
  type: 'listItem'
  content: BlockNode[]
}

export interface BulletListNode {
  type: 'bulletList'
  content: ListItemNode[]
}

export interface OrderedListNode {
  type: 'orderedList'
  attrs?: { start?: number }
  content: ListItemNode[]
}

export interface BlockquoteNode {
  type: 'blockquote'
  content: BlockNode[]
}

export interface CodeBlockNode {
  type: 'codeBlock'
  content?: TextNode[]
}

// A cell can be merged with the cells to its right (colspan) or below (rowspan); a cell that
// spans one column and one row has no attrs. The cells a merged cell covers aren't in the
// rows at all, as in HTML.
export interface TableCellNode {
  type: 'tableCell' | 'tableHeader'
  attrs?: { colspan?: number; rowspan?: number }
  content: BlockNode[]
}

export interface TableRowNode {
  type: 'tableRow'
  content: TableCellNode[]
}

export interface TableNode {
  type: 'table'
  content: TableRowNode[]
}

// Shows a data item (pasted table, CSV or JSON file, API result, or link to large raw data)
export interface DataBlockNode {
  type: 'dataBlock'
  attrs: { dataItemId: string }
}

// Shows an image, or links to another kind of file. `fileId` is the file's SHA-256 (in hex),
// so a version's hash also covers the files it shows. `alt` describes an image for people who
// can't see it; `caption` is shown with it.
export interface FileBlockNode {
  type: 'fileBlock'
  attrs: { fileId: string; caption?: string; alt?: string }
}

// A protocol step that can be ticked off, recording who ticked it and when
export interface ProtocolStepNode {
  type: 'protocolStep'
  attrs: { done: boolean; doneBy?: string; doneAt?: string }
  content?: InlineNode[]
}

export interface Material {
  name: string
  supplier?: string
  catalogueNumber?: string
  lotNumber?: string
  amount?: string
}

// Reagents and consumables used, with lot numbers
export interface MaterialsNode {
  type: 'materials'
  attrs: { items: Material[] }
}

// A link to a record elsewhere, such as a ProtoLIMS sample
export interface RecordLinkNode {
  type: 'recordLink'
  attrs: { system: string; kind: string; url: string; label: string; externalId?: string }
}

export type BlockNode =
  | ParagraphNode
  | HeadingNode
  | BulletListNode
  | OrderedListNode
  | BlockquoteNode
  | CodeBlockNode
  | TableNode
  | DataBlockNode
  | FileBlockNode
  | ProtocolStepNode
  | MaterialsNode
  | RecordLinkNode

export interface DocNode {
  type: 'doc'
  content: BlockNode[]
}
