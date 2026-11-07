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
| `table` | Rows (`tableRow`) of cells (`tableCell` or `tableHeader`), each holding blocks. A merged cell has `attrs.colspan` (the columns it spans) and/or `attrs.rowspan` (the rows), each from 2 to 100; the cells it covers aren't in the rows at all, as in HTML. Cells have no other attributes |
| `dataBlock` | Shows a data item: `attrs.dataItemId` |
| `fileBlock` | Shows an image or links to a file: `attrs.fileId`, the file's SHA-256 in hex (so a version's hash covers the file too), optional `attrs.caption` (shown with it) and `attrs.alt` (describing an image for people who can't see it) |
| `protocolStep` | A step that can be ticked off: `attrs.done`; once ticked, `attrs.doneBy` (the ORCID iD of who ticked it) and `attrs.doneAt` (when, in UTC, ISO 8601), both set by the server; inline content |
| `materials` | Reagents and consumables: `attrs.items`, each with a `name` and optional `supplier`, `catalogueNumber`, `lotNumber` and `amount` |
| `recordLink` | A link to a record: `attrs.system`, `kind`, `url`, `label`, optional `externalId`. A link to another entry has system `protoeln`, kind `entry`, a `url` such as `/entries/ELN-2026-0003`, and the entry's code as `externalId`; a link elsewhere (e.g. a ProtoLIMS sample) has the site's host name as `system`, such as `protolims.org`. The `url` must start `https://`, `http://` or `/` |

## Inline content and marks

Inline content is `text` (which must not be empty) and `hardBreak` (a line break within a block).

Text can carry these marks: `bold`, `italic`, `code`, `subscript`, `superscript` and `link`
(with `attrs.href`).

## From an editor

`fromProseMirror` turns a document from a ProseMirror-based editor, such as Tiptap's
`getJSON()`, into this format. It keeps exactly what the format holds: attributes an editor adds
at their defaults (a code block's language, a link's target, a table cell's colspan), nulls for
optional attributes, and empty content lists are left out, as are empty paragraphs at the very
end of the document (editors keep one there to type into). Anything the format doesn't list is
passed on unchanged, so checking reports it rather than losing it. So is a table cell's span when
it isn't 1 (a merged cell, perhaps pasted in): it's kept for checking to report, and the cell can
be split in the editor. Column widths are left out, as how wide a column is drawn isn't content.

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
