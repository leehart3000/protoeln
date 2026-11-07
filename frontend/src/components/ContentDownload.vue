<script setup lang="ts">
import { computed } from 'vue'

import type { FileInfo } from '../api'
import { formatSize } from '../format'
import { DocumentIcon, SpreadsheetIcon } from '../icons'
import { textLink } from '../styles'

// A file in an entry's content (a fileBlock) that isn't an image, such as a spreadsheet or a
// PDF: a link to download it, with its name, kind and size, and its caption. The API only ever
// sends such files as downloads, to those who can read the entry.
const props = defineProps<{ fileId: string; file: FileInfo; caption?: string }>()

const KINDS: Record<string, string> = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel spreadsheet',
  'application/vnd.ms-excel': 'Excel spreadsheet (older format)',
  'text/csv': 'CSV file',
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word document',
  'chemical/x-cdx': 'ChemDraw file',
  'chemical/x-cdxml': 'ChemDraw file (XML)',
}

// Spreadsheets get a spreadsheet icon; anything else a document icon
const SPREADSHEETS = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
]

const source = computed(() =>
  /^[0-9a-f]{64}$/.test(props.fileId) ? `/api/v1/files/${props.fileId}` : undefined,
)
const about = computed(
  () => `${KINDS[props.file.contentType] ?? 'File'}, ${formatSize(props.file.size)}`,
)
</script>

<template>
  <figure class="my-4 rounded-md border border-line bg-panel px-4 py-3">
    <a
      :href="source"
      :download="file.name"
      :class="textLink"
      class="inline-flex items-center gap-2"
    >
      <component
        :is="SPREADSHEETS.includes(file.contentType) ? SpreadsheetIcon : DocumentIcon"
        aria-hidden="true"
        class="size-5 shrink-0"
      />
      <span class="wrap-anywhere">{{ file.name }}</span>
    </a>
    <span class="ml-2 text-sm text-muted">({{ about }})</span>
    <figcaption v-if="caption" class="mt-1 text-sm text-muted">{{ caption }}</figcaption>
  </figure>
</template>
