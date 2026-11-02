import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/vue'

import App from '../App.vue'

describe('App', () => {
  it('shows the page heading', () => {
    render(App)

    expect(
      screen.getByRole('heading', { level: 1, name: 'A living lab notebook' }),
    ).toBeInTheDocument()
  })
})
