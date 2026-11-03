import type { DocNode } from './types.ts'

// Checks that a value is a valid protoeln-doc/1 document. Rather than stopping at the first
// problem, it lists every problem it finds, each with its location (e.g. "content[2].attrs.level"),
// so that people (and tests) can see exactly what is wrong.

export interface Problem {
  path: string
  message: string
}

type Check = (value: unknown, path: string, problems: Problem[]) => void

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function at(path: string, key: string | number) {
  return typeof key === 'number' ? `${path}[${key}]` : path ? `${path}.${key}` : key
}

function checkString(value: unknown, path: string, problems: Problem[], optional = false) {
  if (optional && value === undefined) return
  if (typeof value !== 'string') problems.push({ path, message: 'should be text' })
}

function checkNode(
  value: unknown,
  path: string,
  problems: Problem[],
  allowed: Record<string, Check>,
  kind: string,
) {
  if (!isObject(value)) {
    problems.push({ path, message: `should be ${kind}` })
    return
  }
  const type = value.type
  const check = typeof type === 'string' ? allowed[type] : undefined
  if (check === undefined) {
    problems.push({
      path: at(path, 'type'),
      message: `should be one of: ${Object.keys(allowed).join(', ')}`,
    })
    return
  }
  check(value, path, problems)
}

function checkList(
  value: unknown,
  path: string,
  problems: Problem[],
  item: Check,
  options: { optional?: boolean; nonEmpty?: boolean } = {},
) {
  if (options.optional && value === undefined) return
  if (!Array.isArray(value)) {
    problems.push({ path, message: 'should be a list' })
    return
  }
  if (options.nonEmpty && value.length === 0) {
    problems.push({ path, message: 'should not be empty' })
  }
  value.forEach((child, index) => item(child, at(path, index), problems))
}

function checkAttrs(
  node: Record<string, unknown>,
  path: string,
  problems: Problem[],
  check: (attrs: Record<string, unknown>, path: string) => void,
  optional = false,
) {
  const attrs = node.attrs
  if (optional && attrs === undefined) return
  if (!isObject(attrs)) {
    problems.push({ path: at(path, 'attrs'), message: 'should be an object' })
    return
  }
  check(attrs, at(path, 'attrs'))
}

// Marks

const MARKS: Record<string, Check> = {
  bold: () => {},
  italic: () => {},
  code: () => {},
  subscript: () => {},
  superscript: () => {},
  link: (value, path, problems) =>
    checkAttrs(value as Record<string, unknown>, path, problems, (attrs, attrsPath) =>
      checkString(attrs.href, at(attrsPath, 'href'), problems),
    ),
}

const checkMark: Check = (value, path, problems) =>
  checkNode(value, path, problems, MARKS, 'a mark')

// Inline nodes

const checkText: Check = (value, path, problems) => {
  const node = value as Record<string, unknown>
  if (typeof node.text !== 'string' || node.text === '') {
    problems.push({ path: at(path, 'text'), message: 'should be text that is not empty' })
  }
  checkList(node.marks, at(path, 'marks'), problems, checkMark, { optional: true })
}

const INLINE: Record<string, Check> = {
  text: checkText,
  hardBreak: () => {},
}

const checkInline: Check = (value, path, problems) =>
  checkNode(value, path, problems, INLINE, 'inline content')

function inlineContent(value: unknown, path: string, problems: Problem[]) {
  const node = value as Record<string, unknown>
  checkList(node.content, at(path, 'content'), problems, checkInline, { optional: true })
}

// Blocks

function blockContent(value: unknown, path: string, problems: Problem[]) {
  const node = value as Record<string, unknown>
  checkList(node.content, at(path, 'content'), problems, checkBlock, { nonEmpty: true })
}

const checkListItem: Check = (value, path, problems) =>
  checkNode(value, path, problems, { listItem: blockContent }, 'a list item')

function listContent(value: unknown, path: string, problems: Problem[]) {
  const node = value as Record<string, unknown>
  checkList(node.content, at(path, 'content'), problems, checkListItem, { nonEmpty: true })
}

const checkTableCell: Check = (value, path, problems) =>
  checkNode(value, path, problems, { tableCell: blockContent, tableHeader: blockContent }, 'a cell')

function rowContent(value: unknown, path: string, problems: Problem[]) {
  const node = value as Record<string, unknown>
  checkList(node.content, at(path, 'content'), problems, checkTableCell, { nonEmpty: true })
}

const checkTableRow: Check = (value, path, problems) =>
  checkNode(value, path, problems, { tableRow: rowContent }, 'a table row')

const BLOCKS: Record<string, Check> = {
  paragraph: inlineContent,
  heading: (value, path, problems) => {
    checkAttrs(value as Record<string, unknown>, path, problems, (attrs, attrsPath) => {
      if (attrs.level !== 1 && attrs.level !== 2 && attrs.level !== 3) {
        problems.push({ path: at(attrsPath, 'level'), message: 'should be 1, 2 or 3' })
      }
    })
    inlineContent(value, path, problems)
  },
  bulletList: listContent,
  orderedList: (value, path, problems) => {
    checkAttrs(
      value as Record<string, unknown>,
      path,
      problems,
      (attrs, attrsPath) => {
        if (attrs.start !== undefined && !Number.isInteger(attrs.start)) {
          problems.push({ path: at(attrsPath, 'start'), message: 'should be a whole number' })
        }
      },
      true,
    )
    listContent(value, path, problems)
  },
  blockquote: blockContent,
  codeBlock: (value, path, problems) => {
    const node = value as Record<string, unknown>
    checkList(
      node.content,
      at(path, 'content'),
      problems,
      (child, childPath) => checkNode(child, childPath, problems, { text: checkText }, 'text'),
      { optional: true },
    )
  },
  table: (value, path, problems) => {
    const node = value as Record<string, unknown>
    checkList(node.content, at(path, 'content'), problems, checkTableRow, { nonEmpty: true })
  },
  dataBlock: (value, path, problems) =>
    checkAttrs(value as Record<string, unknown>, path, problems, (attrs, attrsPath) =>
      checkString(attrs.dataItemId, at(attrsPath, 'dataItemId'), problems),
    ),
  fileBlock: (value, path, problems) =>
    checkAttrs(value as Record<string, unknown>, path, problems, (attrs, attrsPath) => {
      checkString(attrs.fileId, at(attrsPath, 'fileId'), problems)
      checkString(attrs.caption, at(attrsPath, 'caption'), problems, true)
    }),
  protocolStep: (value, path, problems) => {
    checkAttrs(value as Record<string, unknown>, path, problems, (attrs, attrsPath) => {
      if (typeof attrs.done !== 'boolean') {
        problems.push({ path: at(attrsPath, 'done'), message: 'should be true or false' })
      }
      checkString(attrs.doneBy, at(attrsPath, 'doneBy'), problems, true)
      checkString(attrs.doneAt, at(attrsPath, 'doneAt'), problems, true)
    })
    inlineContent(value, path, problems)
  },
  materials: (value, path, problems) =>
    checkAttrs(value as Record<string, unknown>, path, problems, (attrs, attrsPath) =>
      checkList(attrs.items, at(attrsPath, 'items'), problems, (item, itemPath) => {
        if (!isObject(item)) {
          problems.push({ path: itemPath, message: 'should be an object' })
          return
        }
        checkString(item.name, at(itemPath, 'name'), problems)
        for (const key of ['supplier', 'catalogueNumber', 'lotNumber', 'amount']) {
          checkString(item[key], at(itemPath, key), problems, true)
        }
      }),
    ),
  recordLink: (value, path, problems) =>
    checkAttrs(value as Record<string, unknown>, path, problems, (attrs, attrsPath) => {
      for (const key of ['system', 'kind', 'url', 'label']) {
        checkString(attrs[key], at(attrsPath, key), problems)
      }
      checkString(attrs.externalId, at(attrsPath, 'externalId'), problems, true)
    }),
}

function checkBlock(value: unknown, path: string, problems: Problem[]) {
  checkNode(value, path, problems, BLOCKS, 'a block')
}

export function checkDocument(value: unknown): Problem[] {
  const problems: Problem[] = []
  if (!isObject(value) || value.type !== 'doc') {
    return [{ path: '', message: 'should be a document ({ "type": "doc", "content": [...] })' }]
  }
  checkList(value.content, 'content', problems, checkBlock)
  return problems
}

export function isDocument(value: unknown): value is DocNode {
  return checkDocument(value).length === 0
}
