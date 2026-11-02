import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/vue'

import App from '../App.vue'

describe('App', () => {
  it('shows the welcome heading', () => {
    render(App)

    expect(screen.getByRole('heading', { name: 'You did it!' })).toBeInTheDocument()
  })
})
