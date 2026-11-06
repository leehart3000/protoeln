<script setup lang="ts">
import { computed } from 'vue'

import type { EntrySource } from '../api'
import { formatDay } from '../format'
import { detailList, detailTerm, detailValue } from '../styles'
import LinkedText from './LinkedText.vue'

// Where an imported entry came from, crediting its original authors by name: the record it was
// imported from, who wrote it, when it was published, its DOI, its licence, and how to cite it.
// Shown in the entry's Details.
const props = defineProps<{ source: EntrySource }>()

const doiAddress = computed(() => (props.source.doi ? `https://doi.org/${props.source.doi}` : ''))
const published = computed(() =>
  props.source.publishedOn ? formatDay(props.source.publishedOn) : '',
)
const authors = computed(() => props.source.authors.join('; '))
</script>

<template>
  <h3 class="mt-6 font-semibold">Source</h3>
  <dl :class="detailList" class="!mt-3">
    <dt :class="detailTerm">Imported from:</dt>
    <dd :class="detailValue"><LinkedText :text="source.url" /></dd>
    <template v-if="authors">
      <dt :class="detailTerm">Original authors:</dt>
      <dd :class="detailValue">{{ authors }}</dd>
    </template>
    <template v-if="published">
      <dt :class="detailTerm">Published:</dt>
      <dd :class="detailValue">{{ published }}</dd>
    </template>
    <template v-if="doiAddress">
      <dt :class="detailTerm">DOI:</dt>
      <dd :class="detailValue"><LinkedText :text="doiAddress" /></dd>
    </template>
    <template v-if="source.licence">
      <dt :class="detailTerm">Licence:</dt>
      <dd :class="detailValue"><LinkedText :text="source.licence" /></dd>
    </template>
    <template v-if="source.citation">
      <dt :class="detailTerm">Cite as:</dt>
      <dd :class="detailValue"><LinkedText :text="source.citation" /></dd>
    </template>
  </dl>
</template>
