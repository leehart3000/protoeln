<script setup lang="ts">
import { fieldHint, fieldLabel, inputClass } from '../styles'

// The credit for a project's data, on the New project and Edit project forms (with the same
// hints as ProtoLIMS's): where it comes from, how it's licensed and how to cite it. All are
// optional, and web addresses in them become links on the project's page.
const sourceRepository = defineModel<string>('sourceRepository', { required: true })
const licence = defineModel<string>('licence', { required: true })
const citation = defineModel<string>('citation', { required: true })

const optional = '(optional)'
</script>

<template>
  <div>
    <label for="sourceRepository" :class="fieldLabel">
      Source repository <span class="font-normal text-muted">{{ optional }}</span>
    </label>
    <p id="sourceRepository-hint" :class="fieldHint">
      Where the data comes from, such as a Zenodo record or a GitHub repository.
    </p>
    <input
      id="sourceRepository"
      v-model="sourceRepository"
      aria-describedby="sourceRepository-hint"
      :class="[inputClass, 'border-line']"
    />
  </div>
  <div>
    <label for="licence" :class="fieldLabel">
      Licence <span class="font-normal text-muted">{{ optional }}</span>
    </label>
    <p id="licence-hint" :class="fieldHint">
      For example, CC BY 4.0, or the terms the source sets. Web addresses become links.
    </p>
    <input
      id="licence"
      v-model="licence"
      aria-describedby="licence-hint"
      :class="[inputClass, 'border-line']"
    />
  </div>
  <div>
    <label for="citation" :class="fieldLabel">
      Citation <span class="font-normal text-muted">{{ optional }}</span>
    </label>
    <p id="citation-hint" :class="fieldHint">
      How to cite the data: papers or records, with their DOIs as web addresses (which become
      links).
    </p>
    <textarea
      id="citation"
      v-model="citation"
      rows="3"
      aria-describedby="citation-hint"
      :class="[inputClass, 'border-line']"
    ></textarea>
  </div>
</template>
