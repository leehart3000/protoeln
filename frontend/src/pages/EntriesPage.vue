<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'

import { fetchAllEntries } from '../api'
import EntryTable from '../components/EntryTable.vue'
import PageTitle from '../components/PageTitle.vue'
import QueryStatus from '../components/QueryStatus.vue'
import { EntryIcon } from '../icons'

// Every entry the visitor can read, across projects, most recently saved first
const { data, isPending, isError } = useQuery({ queryKey: ['entries'], queryFn: fetchAllEntries })
</script>

<template>
  <PageTitle :icon="EntryIcon">Entries</PageTitle>
  <div class="mt-6">
    <QueryStatus :pending="isPending" :failed="isError" what="entries">
      <template v-if="data">
        <p v-if="data.length === 0" class="text-muted">There are no entries you can see yet.</p>
        <EntryTable v-else :entries="data" show-place />
      </template>
    </QueryStatus>
  </div>
</template>
