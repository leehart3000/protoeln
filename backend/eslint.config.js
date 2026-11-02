import { defineConfig, globalIgnores } from 'eslint/config'
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import skipFormatting from 'eslint-config-prettier/flat'

export default defineConfig(
  globalIgnores(['coverage/**']),
  js.configs.recommended,
  tseslint.configs.recommended,
  skipFormatting,
)
