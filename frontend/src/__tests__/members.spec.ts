import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import { project } from './fixtures'
import { fakeApi, renderAt, sentBody } from './helpers'

const ADA = '0000-0002-1825-0097'
const MO = '0000-0002-1694-233X'
const NEW = '0000-0001-5109-3700'

const ada = { name: 'Ada Admin', orcid: ADA, orcidUrl: `https://orcid.org/${ADA}`, signedIn: true }
const mo = { name: 'Mo Member', orcid: MO, orcidUrl: `https://orcid.org/${MO}`, signedIn: true }
const newcomer = { name: NEW, orcid: NEW, orcidUrl: `https://orcid.org/${NEW}`, signedIn: false }

const members = [
  { ...ada, role: 'admin' },
  { ...mo, role: 'member' },
]

function me(siteAdmin: boolean) {
  return {
    user: {
      name: 'Ada Admin',
      orcid: ADA,
      orcidUrl: `https://orcid.org/${ADA}`,
      siteAdmin,
      since: '2026-11-03T17:00:00.000Z',
      roles: [{ project: { code: 'LAB', title: 'Lab' }, role: 'admin' }],
    },
  }
}

function lab(canManageMembers: boolean) {
  return {
    project: {
      ...project,
      code: 'LAB',
      title: 'Lab',
      yourRole: 'admin',
      canContribute: true,
      canManageMembers,
    },
    notebooks: [],
  }
}

function fakeLab(answers: Record<string, unknown> = {}, siteAdmin = false) {
  return fakeApi({
    '/api/v1/me': me(siteAdmin),
    '/api/v1/projects/LAB': lab(true),
    '/api/v1/projects/LAB/members': members,
    ...answers,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('project members', () => {
  it('lets a project admin change someone’s role, saying what changed', async () => {
    const fetchMock = fakeLab({
      [`PUT /api/v1/projects/LAB/members/${MO}`]: [
        { ...ada, role: 'admin' },
        { ...mo, role: 'viewer' },
      ],
    })
    const user = userEvent.setup()
    await renderAt('/projects/LAB')

    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Role for Mo Member' }),
      'viewer',
    )
    await user.click(screen.getByRole('button', { name: 'Save role for Mo Member' }))

    expect(await screen.findByText('Mo Member now has the Viewer role.')).toBeInTheDocument()
    expect(sentBody(fetchMock, 'PUT', `/api/v1/projects/LAB/members/${MO}`)).toEqual({
      role: 'viewer',
    })
  })

  it('adds someone by ORCID iD, even before they first sign in', async () => {
    const fetchMock = fakeLab({
      [`PUT /api/v1/projects/LAB/members/${NEW}`]: [...members, { ...newcomer, role: 'member' }],
    })
    const user = userEvent.setup()
    await renderAt('/projects/LAB')

    await user.type(await screen.findByLabelText('ORCID iD'), NEW)
    await user.selectOptions(screen.getByLabelText('Role'), 'member')
    await user.click(screen.getByRole('button', { name: 'Add member' }))

    expect(await screen.findByText(`${NEW} now has the Member role.`)).toBeInTheDocument()
    expect(screen.getByText('Not signed in yet')).toBeInTheDocument()
    expect(sentBody(fetchMock, 'PUT', `/api/v1/projects/LAB/members/${NEW}`)).toEqual({
      role: 'member',
    })
  })

  it('asks before taking someone’s role away', async () => {
    const fetchMock = fakeLab({
      [`DELETE /api/v1/projects/LAB/members/${MO}`]: [{ ...ada, role: 'admin' }],
    })
    const user = userEvent.setup()
    await renderAt('/projects/LAB')

    await user.click(await screen.findByRole('button', { name: 'Remove Mo Member' }))
    expect(screen.getByText('Remove Mo Member’s role?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Yes, remove' }))

    expect(await screen.findByText('Mo Member’s role was removed.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(`/api/v1/projects/LAB/members/${MO}`, {
      method: 'DELETE',
    })
  })

  it('leaves the project admin role to site admins', async () => {
    fakeLab()
    await renderAt('/projects/LAB')

    const remove = await screen.findByRole('button', { name: 'Remove Ada Admin' })
    expect(remove).toHaveAttribute('aria-disabled', 'true')
    expect(remove).toHaveAccessibleDescription(
      'Only site admins can give or take away the project admin role.',
    )
    for (const option of screen.getAllByRole('option', { name: 'Project admin' })) {
      expect(option).toBeDisabled()
    }
  })

  it('is only shown to people who can choose the members', async () => {
    fakeApi({ '/api/v1/me': me(false), '/api/v1/projects/LAB': lab(false) })
    await renderAt('/projects/LAB')

    expect(await screen.findByRole('heading', { level: 1, name: 'Lab' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Members' })).not.toBeInTheDocument()
  })
})
