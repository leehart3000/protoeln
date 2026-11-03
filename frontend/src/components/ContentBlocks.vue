<script setup lang="ts">
import type { BlockNode } from '@protoeln/content'

import { InlineContent, isSafeHref } from '../content'
import { StepDoneIcon, StepIcon } from '../icons'
import { table, tableCell, tableHead, tableHeader, tableWrapper, textLink } from '../styles'

// Shows entry content (protoeln-doc/1, see docs/content-format.md) for reading. It shows each
// kind of block in the format, and calls itself for blocks inside blocks (list items, quotes
// and table cells). Headings in the content come below the page's own headings (h1 and h2), so
// a level 1 heading is shown as h3.
defineProps<{ blocks: BlockNode[] }>()

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
        <ContentBlocks :blocks="item.content" />
      </li>
    </ul>
    <ol
      v-else-if="block.type === 'orderedList'"
      :start="block.attrs?.start"
      class="list-decimal space-y-1 pl-6"
    >
      <li v-for="(item, i) in block.content" :key="i" class="space-y-2">
        <ContentBlocks :blocks="item.content" />
      </li>
    </ol>
    <blockquote
      v-else-if="block.type === 'blockquote'"
      class="space-y-2 border-l-4 border-line pl-4 text-muted"
    >
      <ContentBlocks :blocks="block.content" />
    </blockquote>
    <pre
      v-else-if="block.type === 'codeBlock'"
      class="overflow-x-auto rounded-md border border-line bg-panel p-3 font-mono text-sm"
    ><code>{{ (block.content ?? []).map((node) => node.text).join('') }}</code></pre>
    <div v-else-if="block.type === 'table'" :class="tableWrapper">
      <table :class="table">
        <tbody class="divide-y divide-line">
          <tr v-for="(row, r) in block.content" :key="r">
            <component
              :is="cell.type === 'tableHeader' ? 'th' : 'td'"
              v-for="(cell, c) in row.content"
              :key="c"
              :class="[tableCell, cell.type === 'tableHeader' && 'bg-line/40 font-semibold']"
            >
              <ContentBlocks :blocks="cell.content" />
            </component>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else-if="block.type === 'protocolStep'" class="flex items-start gap-2">
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
    <p v-else-if="block.type === 'recordLink'">
      <a v-if="isSafeHref(block.attrs.url)" :href="block.attrs.url" :class="textLink">
        {{ block.attrs.label }}
      </a>
      <span v-else>{{ block.attrs.label }}</span>
      <span class="text-muted"> ({{ block.attrs.system }} {{ block.attrs.kind }})</span>
    </p>
    <p v-else-if="block.type === 'dataBlock'" :class="placeholder">
      Data (shown here once data can be added to entries)
    </p>
    <p v-else-if="block.type === 'fileBlock'" :class="placeholder">
      {{ block.attrs.caption || 'A file' }} (shown here once files can be added to entries)
    </p>
  </template>
</template>
