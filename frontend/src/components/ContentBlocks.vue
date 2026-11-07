<script setup lang="ts">
import type { BlockNode } from '@protoeln/content'
import { computed } from 'vue'

import type { FileInfo } from '../api'
import { InlineContent, isSafeHref } from '../content'
import { formatDateTime } from '../format'
import { ExternalIcon, StepDoneIcon, StepIcon } from '../icons'
import { isEntryLink, linkTarget } from '../records'
import { table, tableCell, tableHead, tableHeader, tableWrapper, textLink } from '../styles'
import ContentDownload from './ContentDownload.vue'
import ContentImage from './ContentImage.vue'

// Shows entry content (protoeln-doc/1, see docs/content-format.md) for reading. It shows each
// kind of block in the format, and calls itself for blocks inside blocks (list items, quotes
// and table cells). Headings in the content come below the page's own headings (h1 and h2), so
// a level 1 heading is shown as h3.
//
// Protocol steps say who ticked them and when. Given `tick`, each step has a tick box, which
// asks for the step to be ticked (or unticked) by its path in the document (see stepsOf in
// @protoeln/content); the box changes once the tick has been saved and the content comes back.
const props = withDefaults(
  defineProps<{
    blocks: BlockNode[]
    // Where these blocks are in the document (empty for the document's own blocks)
    path?: number[]
    // Names of the people who ticked steps, by ORCID iD
    people?: Record<string, string>
    // The name, type and size of each file shown, by SHA-256: images are shown, and anything
    // else (such as a spreadsheet or PDF) is offered as a download
    files?: Record<string, FileInfo>
    tick?: (path: number[], done: boolean) => void
    // Whether a tick is being saved
    ticking?: boolean
  }>(),
  { path: () => [], people: () => ({}), files: () => ({}), tick: undefined, ticking: false },
)

// Who ticked a step, and when
function doneText(attrs: { doneBy?: string; doneAt?: string }) {
  const who = attrs.doneBy ? (props.people[attrs.doneBy] ?? attrs.doneBy) : 'someone'
  return attrs.doneAt ? `Done by ${who}, ${formatDateTime(attrs.doneAt)}` : `Done by ${who}`
}

// Passed on to the blocks inside blocks
const passOn = computed(() => ({
  people: props.people,
  files: props.files,
  tick: props.tick,
  ticking: props.ticking,
}))

// A file that isn't an image (one the API knows; an unknown file is tried as an image)
function isDownload(fileId: string) {
  const file = props.files[fileId]
  return file !== undefined && !file.contentType.startsWith('image/')
}

const MATERIAL_COLUMNS = [
  { key: 'name', label: 'Material' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'catalogueNumber', label: 'Catalogue number' },
  { key: 'lotNumber', label: 'Lot number' },
  { key: 'amount', label: 'Amount' },
] as const

const placeholder = 'rounded-md border border-dashed border-line px-4 py-3 text-sm text-muted'
</script>

<template>
  <template v-for="(block, index) in blocks" :key="index">
    <p v-if="block.type === 'paragraph'"><InlineContent :nodes="block.content ?? []" /></p>
    <component
      :is="`h${block.attrs.level + 2}`"
      v-else-if="block.type === 'heading'"
      class="pt-2 font-brand text-lg font-semibold"
    >
      <InlineContent :nodes="block.content ?? []" />
    </component>
    <ul v-else-if="block.type === 'bulletList'" class="list-disc space-y-1 pl-6">
      <li v-for="(item, i) in block.content" :key="i" class="space-y-2">
        <ContentBlocks :blocks="item.content" :path="[...path, index, i]" v-bind="passOn" />
      </li>
    </ul>
    <ol
      v-else-if="block.type === 'orderedList'"
      :start="block.attrs?.start"
      class="list-decimal space-y-1 pl-6"
    >
      <li v-for="(item, i) in block.content" :key="i" class="space-y-2">
        <ContentBlocks :blocks="item.content" :path="[...path, index, i]" v-bind="passOn" />
      </li>
    </ol>
    <blockquote
      v-else-if="block.type === 'blockquote'"
      class="space-y-2 border-l-4 border-line pl-4 text-muted"
    >
      <ContentBlocks :blocks="block.content" :path="[...path, index]" v-bind="passOn" />
    </blockquote>
    <pre
      v-else-if="block.type === 'codeBlock'"
      class="overflow-x-auto rounded-md border border-line bg-panel p-3 font-mono text-sm"
    ><code>{{ (block.content ?? []).map((node) => node.text).join('') }}</code></pre>
    <div v-else-if="block.type === 'table'" :class="tableWrapper">
      <table :class="table">
        <!-- Lines between rows are drawn on each cell (not each row), so a cell merged over
             several rows has no line through it -->
        <tbody>
          <tr v-for="(row, r) in block.content" :key="r">
            <component
              :is="cell.type === 'tableHeader' ? 'th' : 'td'"
              v-for="(cell, c) in row.content"
              :key="c"
              :colspan="cell.attrs?.colspan"
              :rowspan="cell.attrs?.rowspan"
              :class="[
                tableCell,
                r > 0 && 'border-t border-line',
                cell.type === 'tableHeader' && 'bg-line/40 font-semibold',
              ]"
            >
              <ContentBlocks
                :blocks="cell.content"
                :path="[...path, index, r, c]"
                v-bind="passOn"
              />
            </component>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else-if="block.type === 'protocolStep'">
      <label v-if="tick" class="flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          class="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary disabled:cursor-wait"
          :checked="block.attrs.done"
          :disabled="ticking"
          @click.prevent="tick?.([...path, index], !block.attrs.done)"
        />
        <span><InlineContent :nodes="block.content ?? []" /></span>
      </label>
      <div v-else class="flex items-start gap-2">
        <StepDoneIcon
          v-if="block.attrs.done"
          aria-hidden="true"
          class="mt-0.5 size-5 shrink-0 text-primary"
        />
        <StepIcon v-else aria-hidden="true" class="mt-0.5 size-5 shrink-0 text-muted" />
        <p>
          <span class="sr-only">{{ block.attrs.done ? 'Done:' : 'To do:' }}</span>
          <InlineContent :nodes="block.content ?? []" />
        </p>
      </div>
      <p v-if="block.attrs.done && block.attrs.doneBy" class="mt-0.5 pl-7 text-sm text-muted">
        {{ doneText(block.attrs) }}
      </p>
    </div>
    <div v-else-if="block.type === 'materials'" :class="tableWrapper">
      <table :class="table">
        <thead :class="tableHead">
          <tr>
            <th
              v-for="column in MATERIAL_COLUMNS"
              :key="column.key"
              scope="col"
              :class="tableHeader"
            >
              {{ column.label }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr v-for="(item, i) in block.attrs.items" :key="i">
            <td v-for="column in MATERIAL_COLUMNS" :key="column.key" :class="tableCell">
              {{ item[column.key] ?? '' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <!-- A link to another entry stays on this site; one elsewhere opens in a new tab -->
    <p v-else-if="block.type === 'recordLink'" class="flex flex-wrap items-baseline gap-x-2">
      <RouterLink v-if="isEntryLink(block.attrs)" :to="block.attrs.url" :class="textLink">
        {{ block.attrs.label }}
      </RouterLink>
      <a
        v-else-if="isSafeHref(block.attrs.url)"
        :href="block.attrs.url"
        :class="textLink"
        class="inline-flex items-center gap-1"
        :aria-label="`${block.attrs.label} (opens in a new tab)`"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ block.attrs.label }}
        <ExternalIcon aria-hidden="true" class="size-3.5 shrink-0" />
      </a>
      <span v-else>{{ block.attrs.label }}</span>
      <span class="text-sm text-muted">({{ linkTarget(block.attrs) }})</span>
    </p>
    <p v-else-if="block.type === 'dataBlock'" :class="placeholder">
      Data (shown here once data can be added to entries)
    </p>
    <ContentDownload
      v-else-if="block.type === 'fileBlock' && isDownload(block.attrs.fileId)"
      :file-id="block.attrs.fileId"
      :file="files[block.attrs.fileId]!"
      :caption="block.attrs.caption"
    />
    <ContentImage
      v-else-if="block.type === 'fileBlock'"
      :file-id="block.attrs.fileId"
      :alt="block.attrs.alt"
      :caption="block.attrs.caption"
    />
  </template>
</template>
