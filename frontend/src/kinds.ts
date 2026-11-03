import type { Component } from 'vue'

import type { EntryKind } from './api'
import { ExperimentIcon, NoteIcon, ProtocolIcon } from './icons'

// Each kind of entry's icon, used wherever its kind is shown
export const KIND_ICONS: Record<EntryKind, Component> = {
  experiment: ExperimentIcon,
  protocol: ProtocolIcon,
  note: NoteIcon,
}
