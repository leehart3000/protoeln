import { execSync } from 'node:child_process'
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

function git(args: string): string | null {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return null
  }
}

// Which release and commit this build is, shown in the footer (as in ProtoLIMS): "0.3.0" for a
// build of release tag v0.3.0, "0.3.0+2" two commits after it, and "unreleased" before the
// first release. GitLab CI says which commit (and, for a tag's pipeline, which tag) it built.
function buildInfo() {
  const commit = (process.env.CI_COMMIT_SHA ?? git('rev-parse HEAD') ?? 'unknown').slice(0, 7)
  if (process.env.CI_COMMIT_TAG?.startsWith('v')) {
    return { version: process.env.CI_COMMIT_TAG.replace(/^v/, ''), commit }
  }

  // The nearest release tag: "v0.3.0-2-g1a2b3c4" means two commits after v0.3.0
  const match = git('describe --tags --long --match "v*"')?.match(/^v(.+)-(\d+)-g[0-9a-f]+$/)
  const tag = match?.[1]
  const ahead = match?.[2]
  if (!tag || !ahead) {
    return { version: 'unreleased', commit }
  }
  return { version: ahead === '0' ? tag : `${tag}+${ahead}`, commit }
}

const build = buildInfo()
process.env.VITE_APP_VERSION = build.version
process.env.VITE_APP_COMMIT = build.commit

// Which site a build is for, shown as a badge in the header so it's never mistaken for the real
// one (as in ProtoLIMS): "Staging" (set by `just deploy`), "Local" on your own computer, and
// nothing for production (or in CI checks and tests, unless a test sets it). Vite gives VITE_*
// variables to the app as import.meta.env.VITE_*.
process.env.VITE_APP_ENVIRONMENT ??= process.env.CI || process.env.VITEST ? '' : 'Local'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // ProtoLIMS uses Vite's usual ports (5173 and 4173), so ProtoELN uses the next ones up, and
  // both can run at once. Requests to /api go to the API (backend), so the website and the API
  // share one address, as they will when deployed. The API is told the address the browser
  // used (changeOrigin: false keeps the Host header), so sign-in can move a browser on localhost
  // to 127.0.0.1 first.
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: false } },
  },
  preview: {
    host: '127.0.0.1',
    port: 4174,
    strictPort: true,
  },
})
