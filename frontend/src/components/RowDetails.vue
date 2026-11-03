<script setup lang="ts">
import { DetailsIcon } from '../icons'
import { rowButton, tableCell } from '../styles'

// The last cell of a clickable table row: a "Details" button (as ProtoLIMS's RowArrow). The
// whole row is the link, so the button only shows where to click. It's hidden from screen
// readers, because the row's link already says where it goes. On phones, only the icon shows.
</script>

<template>
  <td :class="tableCell" class="w-px" aria-hidden="true">
    <span :class="rowButton">
      <DetailsIcon class="size-4 shrink-0" />
      <span class="hidden sm:inline">Details</span>
    </span>
  </td>
</template>
