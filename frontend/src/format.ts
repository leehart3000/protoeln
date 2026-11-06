import type { EntryKind, EntryStatus, ProjectRole } from './api'

// A date, as in "3 November 2026" (as in ProtoLIMS)
export function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// A calendar date given as YYYY-MM-DD, as in "19 July 2017", the same wherever the reader is
export function formatDay(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

// A date and time, as in "3 Nov 2026, 18:22" (as in ProtoLIMS)
export function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const KIND_LABELS: Record<EntryKind, string> = {
  experiment: 'Experiment',
  protocol: 'Protocol',
  note: 'Note',
}

export const STATUS_LABELS: Record<EntryStatus, string> = {
  draft: 'Draft',
  in_review: 'In review',
  changes_requested: 'Changes requested',
  approved: 'Approved',
  signed: 'Signed',
  witnessed: 'Witnessed',
}

export const ROLE_LABELS: Record<ProjectRole, string> = {
  admin: 'Admin',
  contributor: 'Contributor',
  viewer: 'Viewer',
}
