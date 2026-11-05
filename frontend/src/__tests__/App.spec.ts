import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/vue'

import { fakeApi, renderAt } from './helpers'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('App', () => {
  it('has a header whose wordmark goes to the home page', async () => {
    fakeApi({})
    await renderAt('/')

    expect(screen.getByRole('link', { name: 'ProtoELN' })).toHaveAttribute('href', '/')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Welcome to ProtoELN' }),
    ).toBeInTheDocument()
  })

  it('links to each list in the main navigation, marking the current one', async () => {
    fakeApi({})
    await renderAt('/notebooks/6aea2667810ceb3f4123d140')

    const nav = screen.getByRole('navigation', { name: 'Main' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/projects',
      '/notebooks',
      '/entries',
    ])
    expect(within(nav).getByRole('link', { name: 'Notebooks' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).getByRole('link', { name: 'Projects' })).not.toHaveAttribute('aria-current')
  })

  it('marks the staging site, but not the real one', async () => {
    vi.stubEnv('VITE_APP_ENVIRONMENT', 'Staging')
    fakeApi({})
    const { unmount } = await renderAt('/')
    expect(screen.getByText('Staging')).toBeInTheDocument()
    unmount()

    vi.stubEnv('VITE_APP_ENVIRONMENT', '')
    await renderAt('/')
    expect(screen.queryByText('Staging')).not.toBeInTheDocument()
  })
})
