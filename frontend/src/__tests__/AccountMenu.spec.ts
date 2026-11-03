import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import AccountMenu from '../components/AccountMenu.vue'

// Replaces fetch with one that answers /api/v1/me as given, and records every request
function fakeApi(me: unknown) {
  const fetchMock = vi.fn(async (url: string) =>
    url === '/api/v1/me' ? Response.json(me) : new Response(null, { status: 204 }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AccountMenu', () => {
  it('offers to sign in (with ORCID), coming back to this page', async () => {
    fakeApi({ user: null })
    window.history.replaceState(null, '', '/notebooks/1?tab=entries')

    render(AccountMenu)

    const link = await screen.findByRole('link', { name: 'Sign in' })
    expect(link).toHaveAttribute(
      'href',
      '/api/v1/auth/orcid/login?returnTo=%2Fnotebooks%2F1%3Ftab%3Dentries',
    )
  })

  it('shows who is signed in, and signs them out', async () => {
    const fetchMock = fakeApi({ user: { name: 'Josiah Carberry', orcid: '0000-0002-1825-0097' } })
    const user = userEvent.setup()
    render(AccountMenu)

    expect(await screen.findByText('Josiah Carberry')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/logout', { method: 'POST' })
    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('offers to sign in if the API cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    render(AccountMenu)

    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument()
  })
})
