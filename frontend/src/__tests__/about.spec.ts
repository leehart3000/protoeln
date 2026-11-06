import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/vue'

import { fakeApi, renderAt } from './helpers'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('About page', () => {
  it('says what ProtoELN is, who runs the site and how to get in touch', async () => {
    fakeApi({})
    await renderAt('/about')

    expect(screen.getByRole('heading', { level: 1, name: 'About ProtoELN' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'source code (opens in a new tab)' })).toHaveAttribute(
      'href',
      'https://gitlab.com/leehart3000/protoeln',
    )
    expect(screen.getByRole('link', { name: 'privacy@protoeln.org' })).toHaveAttribute(
      'href',
      'mailto:privacy@protoeln.org',
    )
    expect(screen.getByRole('link', { name: 'privacy notice' })).toHaveAttribute('href', '/privacy')
  })

  it('says whether anyone can read public projects', async () => {
    fakeApi({})
    const { unmount } = await renderAt('/about')
    expect(await screen.findByText(/Anyone can read a public project/)).toBeInTheDocument()
    unmount()

    fakeApi({ '/api/v1/me': { user: null, readOnly: false, publicRead: false } })
    await renderAt('/about')
    expect(await screen.findByText(/This site is private/)).toBeInTheDocument()
  })

  it('says whether the site can be changed at the moment', async () => {
    fakeApi({})
    const { unmount } = await renderAt('/about')
    expect(await screen.findByText(/every change is recorded/)).toBeInTheDocument()
    unmount()

    fakeApi({ '/api/v1/me': { user: null, readOnly: true } })
    await renderAt('/about')
    expect(await screen.findByText(/read-only at the moment/)).toBeInTheDocument()
  })
})

describe('Privacy page', () => {
  it('names who runs the site, what it keeps, and who processes it', async () => {
    fakeApi({})
    await renderAt('/privacy')

    expect(screen.getByRole('heading', { level: 1, name: 'Privacy notice' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Cookies and your browser' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'privacy@protoeln.org' })[0]).toHaveAttribute(
      'href',
      'mailto:privacy@protoeln.org',
    )
    for (const processor of ['Cloudflare', 'MongoDB Atlas', 'ORCID']) {
      expect(screen.getByText(processor, { selector: 'strong' })).toBeInTheDocument()
    }
    expect(screen.getByText(/Last updated: 6 November 2026/)).toBeInTheDocument()
  })
})
