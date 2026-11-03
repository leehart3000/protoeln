import type { BlockNode, DocNode, InlineNode, TableNode } from './types.ts'

// A plain-text copy of a document, for search and for reading without any editor. Blocks are
// separated by blank lines; formatting is dropped, but every word of text is kept.

function inlineText(content: InlineNode[] = []): string {
  return content.map((node) => (node.type === 'text' ? node.text : '\n')).join('')
}

function tableText(table: TableNode): string {
  return table.content
    .map((row) => row.content.map((cell) => blocksText(cell.content, ' ')).join('\t'))
    .join('\n')
}

function blockText(block: BlockNode): string {
  switch (block.type) {
    case 'paragraph':
    case 'heading':
      return inlineText(block.content)
    case 'bulletList':
      return block.content.map((item) => `- ${blocksText(item.content, '\n')}`).join('\n')
    case 'orderedList': {
      const start = block.attrs?.start ?? 1
      return block.content
        .map((item, index) => `${start + index}. ${blocksText(item.content, '\n')}`)
        .join('\n')
    }
    case 'blockquote':
      return blocksText(block.content, '\n\n')
    case 'codeBlock':
      return inlineText(block.content)
    case 'table':
      return tableText(block)
    case 'dataBlock':
      return `[Data: ${block.attrs.dataItemId}]`
    case 'fileBlock':
      return `[File: ${block.attrs.caption ?? block.attrs.fileId}]`
    case 'protocolStep':
      return `[${block.attrs.done ? 'x' : ' '}] ${inlineText(block.content)}`
    case 'materials':
      return block.attrs.items
        .map((item) =>
          [item.name, item.supplier, item.catalogueNumber, item.lotNumber, item.amount]
            .filter((part) => part !== undefined && part !== '')
            .join(', '),
        )
        .join('\n')
    case 'recordLink':
      return `${block.attrs.label} (${block.attrs.url})`
  }
}

function blocksText(blocks: BlockNode[], separator: string): string {
  return blocks.map(blockText).join(separator)
}

export function toPlainText(doc: DocNode): string {
  return blocksText(doc.content, '\n\n')
}
