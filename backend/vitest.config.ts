import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Only starts the server; everything it uses is tested through the app
      exclude: ['src/server.ts'],
    },
  },
})
