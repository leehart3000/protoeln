import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/vue'

// Adds DOM matchers such as toBeInTheDocument() to expect()
import '@testing-library/jest-dom/vitest'

// Remove anything rendered by one test before the next one starts
afterEach(() => {
  cleanup()
})
