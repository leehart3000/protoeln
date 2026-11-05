import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/vue'

// Adds DOM matchers such as toBeInTheDocument() to expect()
import '@testing-library/jest-dom/vitest'

// jsdom doesn't lay pages out, so it leaves out the size and position of a range of text. The
// editor asks for them to scroll the cursor into view; here, every range is empty and at the top.
// (TypeScript's types say every Range has them, so they're looked up untyped.)
const range = Range.prototype as unknown as Record<string, unknown>
if (typeof range.getClientRects !== 'function') {
  range.getClientRects = () => Object.assign([], { item: () => null })
  range.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  })
}

// Remove anything rendered by one test before the next one starts
afterEach(() => {
  cleanup()
})
