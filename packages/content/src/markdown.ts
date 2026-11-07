import type { BlockNode, DocNode, InlineNode, Mark, TableNode, TextNode } from './types.ts'
import { tableGrid } from './tables.ts'

// A Markdown copy of a document (CommonMark with GitHub's tables and task lists), so that
// content stays readable and portable without any editor. Subscript, superscript and
// highlighting, which Markdown lacks, are written as the HTML tags <sub>, <sup> and <mark>,
// which Markdown allows.

// Characters that Markdown would otherwise read as formatting
function escape(text: string): string {
  return text.replace(/[\\`*_[\]<>#|]/g, (character) => `\\${character}`)
}

function applyMark(text: string, mark: Mark): string {
  switch (mark.type) {
    case 'bold':
      return `**${text}**`
    case 'italic':
      return `_${text}_`
    case 'code':
      return text
    case 'subscript':
      return `<sub>${text}</sub>`
    case 'superscript':
      return `<sup>${text}</sup>`
    case 'highlight':
      return `<mark>${text}</mark>`
    case 'link':
      return `[${text}](${mark.attrs.href})`
  }
}

function textMarkdown(node: TextNode): string {
  const marks = node.marks ?? []
  const isCode = marks.some((mark) => mark.type === 'code')
  const base = isCode ? `\`${node.text}\`` : escape(node.text)
  return marks.reduce(applyMark, base)
}

function inlineMarkdown(content: InlineNode[] = []): string {
  return content.map((node) => (node.type === 'text' ? textMarkdown(node) : '  \n')).join('')
}

function indent(text: string, spaces: number): string {
  const padding = ' '.repeat(spaces)
  return text
    .split('\n')
    .map((line, index) => (index === 0 || line === '' ? line : padding + line))
    .join('\n')
}

// Markdown tables can't merge cells, so a merged cell's text is in its first place, and the
// places it covers are empty (see tableGrid)
function tableMarkdown(table: TableNode): string {
  const rows = tableGrid(table).map((row) =>
    row.map((cell) => (cell ? blocksMarkdown(cell.content, ' ').replaceAll('\n', ' ') : '')),
  )
  const width = Math.max(...rows.map((row) => row.length))
  const line = (cells: string[]) =>
    `| ${Array.from({ length: width }, (_, index) => cells[index] ?? '').join(' | ')} |`
  const [header = [], ...body] = rows
  return [line(header), line(Array.from({ length: width }, () => '---')), ...body.map(line)].join(
    '\n',
  )
}

function blockMarkdown(block: BlockNode): string {
  switch (block.type) {
    case 'paragraph':
      return inlineMarkdown(block.content)
    case 'heading':
      return `${'#'.repeat(block.attrs.level)} ${inlineMarkdown(block.content)}`
    case 'bulletList':
      return block.content
        .map((item) => `- ${indent(blocksMarkdown(item.content, '\n\n'), 2)}`)
        .join('\n')
    case 'orderedList': {
      const start = block.attrs?.start ?? 1
      return block.content
        .map((item, index) => {
          const marker = `${start + index}. `
          return marker + indent(blocksMarkdown(item.content, '\n\n'), marker.length)
        })
        .join('\n')
    }
    case 'blockquote':
      return blocksMarkdown(block.content, '\n\n')
        .split('\n')
        .map((line) => (line === '' ? '>' : `> ${line}`))
        .join('\n')
    case 'codeBlock':
      return `\`\`\`\n${(block.content ?? []).map((node) => node.text).join('')}\n\`\`\``
    case 'table':
      return tableMarkdown(block)
    case 'dataBlock':
      return `[Data: ${block.attrs.dataItemId}]`
    case 'fileBlock':
      return `[File: ${escape(block.attrs.caption ?? block.attrs.fileId)}]`
    case 'protocolStep':
      return `- [${block.attrs.done ? 'x' : ' '}] ${inlineMarkdown(block.content)}`
    case 'materials':
      return tableMarkdown({
        type: 'table',
        content: [
          ['Material', 'Supplier', 'Catalogue number', 'Lot number', 'Amount'],
          ...block.attrs.items.map((item) => [
            item.name,
            item.supplier ?? '',
            item.catalogueNumber ?? '',
            item.lotNumber ?? '',
            item.amount ?? '',
          ]),
        ].map((cells) => ({
          type: 'tableRow',
          content: cells.map((text) => ({
            type: 'tableCell',
            content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
          })),
        })),
      })
    case 'recordLink':
      return `[${escape(block.attrs.label)}](${block.attrs.url})`
  }
}

function blocksMarkdown(blocks: BlockNode[], separator: string): string {
  return blocks.map(blockMarkdown).join(separator)
}

export function toMarkdown(doc: DocNode): string {
  return blocksMarkdown(doc.content, '\n\n')
}
