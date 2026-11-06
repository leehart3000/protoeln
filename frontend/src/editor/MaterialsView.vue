<script setup lang="ts">
import type { Material } from '@protoeln/content'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { computed } from 'vue'

import { DeleteIcon, NewIcon } from '../icons'
import { secondaryButton } from '../styles'

// A materials block in the editor: a small table of the reagents and consumables used, one row
// each, with a box for each of its details. A name may be left empty while writing; an empty
// optional detail is left out (rather than stored as empty text), as the content format has it.
// A box's text goes into the entry when you leave the box (its change event), not at each
// keystroke: each change to the entry redraws the editor, which would take the cursor out of
// the box while typing.

const props = defineProps(nodeViewProps)

const COLUMNS = [
  { key: 'name', label: 'Material' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'catalogueNumber', label: 'Catalogue number' },
  { key: 'lotNumber', label: 'Lot number' },
  { key: 'amount', label: 'Amount' },
] as const

type Detail = (typeof COLUMNS)[number]['key']

const items = computed(() => (props.node.attrs.items ?? []) as Material[])

function setItems(next: Material[]) {
  props.updateAttributes({ items: next })
}

function withDetail(item: Material, key: Detail, value: string): Material {
  const changed: Material = { ...item }
  if (key === 'name') {
    changed.name = value
  } else if (value === '') {
    delete changed[key]
  } else {
    changed[key] = value
  }
  return changed
}

function change(index: number, key: Detail, event: Event) {
  const value = (event.target as HTMLInputElement).value
  setItems(items.value.map((item, i) => (i === index ? withDetail(item, key, value) : item)))
}

// Both icon buttons delete, so they're red, so as not to be mistaken for anything else
const iconButton =
  'inline-flex size-9 shrink-0 items-center justify-center rounded-md text-danger hover:bg-danger/10'
const cellInput =
  'w-full min-w-28 rounded border border-line bg-page px-2 py-1 text-sm focus:outline-2 focus:outline-link'
</script>

<template>
  <NodeViewWrapper class="materials-block" contenteditable="false">
    <div class="flex items-center justify-between gap-2">
      <span class="text-sm font-semibold">Materials</span>
      <button
        type="button"
        :class="iconButton"
        aria-label="Delete materials"
        title="Delete materials"
        @click="deleteNode()"
      >
        <DeleteIcon aria-hidden="true" class="size-4" />
      </button>
    </div>
    <div class="overflow-x-auto">
      <table v-if="items.length > 0" class="w-full text-left text-sm">
        <thead>
          <tr>
            <th v-for="column in COLUMNS" :key="column.key" scope="col" class="px-1 py-1">
              {{ column.label }}
            </th>
            <th scope="col" class="px-1 py-1"><span class="sr-only">Delete</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in items" :key="index">
            <td v-for="column in COLUMNS" :key="column.key" class="px-1 py-1">
              <input
                :class="cellInput"
                :aria-label="`${column.label}, row ${index + 1}`"
                :value="item[column.key] ?? ''"
                @change="change(index, column.key, $event)"
              />
            </td>
            <td class="px-1 py-1">
              <button
                type="button"
                :class="iconButton"
                :aria-label="`Delete material, row ${index + 1}`"
                title="Delete material"
                @click="setItems(items.filter((_, i) => i !== index))"
              >
                <DeleteIcon aria-hidden="true" class="size-4" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="py-1 text-sm text-muted">No materials yet.</p>
    </div>
    <button
      type="button"
      :class="secondaryButton"
      class="mt-2 inline-flex items-center gap-2"
      @click="setItems([...items, { name: '' }])"
    >
      <NewIcon aria-hidden="true" class="size-4 shrink-0" />
      Add material
    </button>
  </NodeViewWrapper>
</template>
