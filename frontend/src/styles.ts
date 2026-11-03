// Tailwind classes used on many pages, kept in one place so the pages look alike (as in
// ProtoLIMS's styles.ts)

export const textLink = 'text-link underline hover:no-underline'

export const errorBox =
  'rounded-lg border border-danger-line bg-danger-bg px-4 py-3 font-medium text-danger'

export const sectionHeading = 'font-brand text-xl font-semibold tracking-tight'

export const tableWrapper = 'overflow-x-auto rounded-lg border border-line bg-panel'

export const table = 'w-full text-left text-sm'

export const tableHead =
  'border-b border-line bg-line/40 text-xs font-semibold tracking-wide whitespace-nowrap text-muted uppercase'

export const tableHeader = 'px-4 py-3'

export const tableCell = 'px-4 py-3 align-top'

// "relative" lets a row link's invisible overlay (rowLink's "after:") cover the whole row
export const tableRow = 'relative hover:bg-line/30'

// No link styling (the whole row is the link); keyboard focus outlines the whole row
export const rowLink =
  'font-medium focus-visible:outline-hidden after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-link'

export const badge =
  'inline-block rounded-full border border-line px-2 py-0.5 text-xs font-medium whitespace-nowrap'
