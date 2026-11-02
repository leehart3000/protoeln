import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      // Adds DOM matchers such as toBeInTheDocument() to expect()
      setupFiles: ['./src/__tests__/setup.ts'],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,vue}'],
      },
    },
  }),
)
