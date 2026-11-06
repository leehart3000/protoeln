import type { RecordLinkNode } from '@protoeln/content'

// Links to records (recordLink blocks; see docs/content-format.md): to another entry here, or
// to a record at any web address, such as a sample in ProtoLIMS (at protolims.org, or wherever
// a lab runs it).

type RecordLink = RecordLinkNode['attrs']

export function linkToEntry(entry: { code: string; title: string }): RecordLink {
  return {
    system: 'protoeln',
    kind: 'entry',
    url: `/entries/${entry.code}`,
    label: entry.title,
    externalId: entry.code,
  }
}

// Whether a link is to an entry on this site (followed without leaving the site)
export function isEntryLink(link: RecordLink) {
  return link.system === 'protoeln' && link.kind === 'entry' && /^\/(?!\/)/.test(link.url)
}

// The paths of ProtoLIMS's record pages, and the kind of record each is
const RECORD_PATHS: [RegExp, string][] = [
  [/^\/projects\/[^/]+\/studies\/([^/]+)\/?$/, 'study'],
  [/^\/projects\/([^/]+)\/?$/, 'project'],
  [/^\/subjects\/([^/]+)\/?$/, 'subject'],
  [/^\/samples\/([^/]+)\/?$/, 'sample'],
  [/^\/assays\/([^/]+)\/?$/, 'assay'],
  [/^\/data-files\/([^/]+)\/?$/, 'data file'],
]

// A link to the record at a web address, labelled `label` (or with the address, if that's
// empty). Its system is the site's host name, and, for an address in ProtoLIMS's form, it says
// what kind of record it is and its code; otherwise it's simply a "record". The address is kept
// exactly as given. Undefined if it isn't an http or https address.
export function linkToAddress(address: string, label: string): RecordLink | undefined {
  let url: URL
  try {
    url = new URL(address)
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined
  const base = { system: url.host, url: address, label: label || address }
  for (const [pattern, kind] of RECORD_PATHS) {
    const code = pattern.exec(url.pathname)?.[1]
    if (code) return { ...base, kind, externalId: decodeURIComponent(code) }
  }
  return { ...base, kind: 'record' }
}

// What a link is to, shown after its label: "entry ELN-2026-0003", "sample on protolims.org",
// or (for a record of an unknown kind) "on example.org"
export function linkTarget(link: RecordLink) {
  if (isEntryLink(link)) return `entry ${link.externalId ?? ''}`.trim()
  const kind = link.kind && link.kind !== 'record' ? `${link.kind} ` : ''
  return `${kind}on ${link.system}`
}
