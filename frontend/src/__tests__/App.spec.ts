import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/vue'

import { fakeApi, renderAt } from './helpers'

const VERSION = /^Version (unreleased|\d+\.\d+\.\d+(\+\d+)?)\/([0-9a-f]{7}|unknown)$/

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

  it('has a footer saying where the source is, its licence, and which version this is', async () => {
    fakeApi({})
    await renderAt('/')

    const footer = screen.getByRole('contentinfo')
    const source = within(footer).getByRole('link', { name: 'free software (opens in a new tab)' })
    expect(source).toHaveAttribute('href', 'https://gitlab.com/leehart3000/protoeln')
    const licence = within(footer).getByRole('link', { name: 'GNU AGPL v3 (opens in a new tab)' })
    expect(licence).toHaveAttribute('href', 'https://www.gnu.org/licenses/agpl-3.0.html')
    // Such as "Version 0.3.0+2/1a2b3c4", or "Version unreleased/1a2b3c4" before the first release
    expect(within(footer).getByText(/^Version /)).toHaveTextContent(VERSION)
  })

  it('shows a lock in the header while the site is read-only', async () => {
    fakeApi({ '/api/v1/me': { user: null, readOnly: true } })
    await renderAt('/')

    const badge = (await screen.findByText('Read-only')).parentElement!
    expect(badge).toHaveAttribute(
      'title',
      'This site is read-only at the moment, so nothing can be changed.',
    )
  })
})
