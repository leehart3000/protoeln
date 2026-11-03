<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'

import { fetchAllNotebooks } from '../api'
import NotebookTable from '../components/NotebookTable.vue'
import PageTitle from '../components/PageTitle.vue'
import QueryStatus from '../components/QueryStatus.vue'
import { NotebookIcon } from '../icons'

// Every notebook the visitor can read, across projects, most recently changed first
const { data, isPending, isError } = useQuery({
  queryKey: ['notebooks'],
  queryFn: fetchAllNotebooks,
})
</script>

<template>
  <PageTitle :icon="NotebookIcon">Notebooks</PageTitle>
  <div class="mt-6">
    <QueryStatus :pending="isPending" :failed="isError" what="notebooks">
      <template v-if="data">
        <p v-if="data.length === 0" class="text-muted">There are no notebooks you can see yet.</p>
        <NotebookTable v-else :notebooks="data" show-project />
      </template>
    </QueryStatus>
  </div>
</template>
