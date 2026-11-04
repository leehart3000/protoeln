import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Starts one temporary MongoDB server for the whole run
    globalSetup: ['./test/global-setup.ts'],
    // The first run downloads the MongoDB server program, which can take a minute or two
    hookTimeout: 180_000,
    // Each test file's first database operations (connecting, building indexes) can take several
    // seconds on a busy machine, more than Vitest's usual 5-second limit for a test
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Only starts the server; everything it uses is tested through the app
      exclude: ['src/server.ts'],
    },
  },
})
