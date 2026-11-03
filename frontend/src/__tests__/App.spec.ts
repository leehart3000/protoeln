import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/vue'

import { fakeApi, renderAt } from './helpers'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('has a header whose wordmark goes to the home page, which lists the projects', async () => {
    fakeApi({ '/api/v1/projects': [] })
    await renderAt('/')

    expect(screen.getByRole('link', { name: 'ProtoELN' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument()
  })
})
