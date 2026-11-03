# Entry content format

Entry content is stored in ProtoELN's own format, **protoeln-doc/1**. It is defined, checked and
converted by the shared package in `packages/content`, which both the API and the website use.

The format uses the document structure of [ProseMirror](https://prosemirror.net/), which the
Tiptap editor is built on: a tree of nodes, each with a `type`, and optionally `attrs`
(attributes), `content` (child nodes) and, for text, `marks` (formatting). Only the nodes and
marks listed here are allowed, so that a different editor could replace Tiptap with a single
converter.

Every stored document is labelled with the format's name (`contentFormat`), so a later format
can be introduced alongside this one.

## Blocks

| Type | Holds |
| --- | --- |
| `paragraph` | Inline content |
| `heading` | Inline content; `attrs.level` 1, 2 or 3 |
| `bulletList`, `orderedList` | List items (`listItem`), each holding blocks; an ordered list may set `attrs.start` |
| `blockquote` | Blocks |
| `codeBlock` | Plain text, without formatting |
| `table` | Rows (`tableRow`) of cells (`tableCell` or `tableHeader`), each holding blocks |
| `dataBlock` | Shows a data item: `attrs.dataItemId` |
| `fileBlock` | Shows an image or links to a file: `attrs.fileId`, optional `attrs.caption` |
| `protocolStep` | A step that can be ticked off: `attrs.done`, optional `attrs.doneBy` and `attrs.doneAt`; inline content |
| `materials` | Reagents and consumables: `attrs.items`, each with a `name` and optional `supplier`, `catalogueNumber`, `lotNumber` and `amount` |
| `recordLink` | A link to a record elsewhere (e.g. a ProtoLIMS sample): `attrs.system`, `kind`, `url`, `label`, optional `externalId` |

## Inline content and marks

Inline content is `text` (which must not be empty) and `hardBreak` (a line break within a block).

Text can carry these marks: `bold`, `italic`, `code`, `subscript`, `superscript` and `link`
(with `attrs.href`).

## Checking

`checkDocument` lists every problem in a document, each with its location (for example
`content[2].attrs.level: should be 1, 2 or 3`), rather than stopping at the first.

## Plain-text and Markdown copies

Each entry version stores two copies made from its content, so it stays readable without any
editor:

- **Plain text** (`toPlainText`): every word of text, without formatting; used for search.
- **Markdown** (`toMarkdown`): CommonMark with GitHub's tables and task lists. Subscript and
  superscript, which Markdown lacks, are written as `<sub>` and `<sup>`.

Data and file blocks appear in both as references (`[Data: …]`, `[File: …]`).
