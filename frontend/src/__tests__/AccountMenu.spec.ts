import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import { fakeApi, renderAt } from './helpers'

const carberry = {
  name: 'Josiah Carberry',
  orcid: '0000-0002-1825-0097',
  orcidUrl: 'https://orcid.org/0000-0002-1825-0097',
  siteAdmin: false,
  since: '2026-11-03T18:22:31.985Z',
  roles: [{ project: { code: 'DEMO', title: 'Example project' }, role: 'member' }],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AccountMenu', () => {
  it('offers to sign in (with ORCID), coming back to this page', async () => {
    fakeApi({})
    await renderAt('/notebooks/1?tab=entries')

    const link = await screen.findByRole('link', { name: 'Sign in' })
    expect(link).toHaveAttribute(
      'href',
      '/api/v1/auth/orcid/login?returnTo=%2Fnotebooks%2F1%3Ftab%3Dentries',
    )
  })

  it('shows who is signed in, linking to their profile, and signs them out', async () => {
    const fetchMock = fakeApi({
      '/api/v1/me': { user: carberry },
      '/api/v1/auth/logout': new Response(null, { status: 204 }),
    })
    const user = userEvent.setup()
    await renderAt('/')

    expect(await screen.findByRole('link', { name: 'Josiah Carberry' })).toHaveAttribute(
      'href',
      '/profile',
    )
    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/logout', { method: 'POST' })
    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('offers to sign in if the API cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await renderAt('/')

    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument()
  })
})

describe('profile page', () => {
  it('shows who is signed in, with their ORCID record and their roles', async () => {
    fakeApi({ '/api/v1/me': { user: carberry } })
    await renderAt('/profile')

    expect(
      await screen.findByRole('link', { name: '0000-0002-1825-0097 (opens in a new tab)' }),
    ).toHaveAttribute('href', 'https://orcid.org/0000-0002-1825-0097')
    expect(screen.getByRole('link', { name: 'DEMO' })).toHaveAttribute('href', '/projects/DEMO')
    expect(screen.getByText('Member')).toBeInTheDocument()
    expect(screen.getByText('3 November 2026')).toBeInTheDocument()
  })

  it('offers to sign in to someone who is not signed in', async () => {
    fakeApi({})
    await renderAt('/profile')

    expect(await screen.findByText("You're not signed in.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in with ORCID' })).toHaveAttribute(
      'href',
      '/api/v1/auth/orcid/login?returnTo=%2Fprofile',
    )
  })
})
