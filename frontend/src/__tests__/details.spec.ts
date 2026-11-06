import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import { notebook, project } from './fixtures'
import { fakeApi, renderAt, sentBody } from './helpers'

// Changing a project's or notebook's details, from the Edit link on its page

const admin = { ...project, yourRole: 'admin', canContribute: true, canManageMembers: true }
const ownNotebook = { ...notebook, canEdit: true }
const notebookAnswer = {
  notebook: ownNotebook,
  project: { code: 'DEMO', title: 'Example project', canContribute: true },
  entries: [],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('editing a project', () => {
  it('offers its admins an Edit link, and no one else', async () => {
    fakeApi({ '/api/v1/projects/DEMO': { project: admin, notebooks: [] } })
    const { unmount } = await renderAt('/projects/DEMO')
    expect(await screen.findByRole('link', { name: 'Edit project' })).toHaveAttribute(
      'href',
      '/projects/DEMO/edit',
    )
    unmount()

    fakeApi({ '/api/v1/projects/DEMO': { project, notebooks: [] } })
    await renderAt('/projects/DEMO')
    await screen.findByRole('heading', { level: 1, name: 'Example project' })
    expect(screen.queryByRole('link', { name: 'Edit project' })).not.toBeInTheDocument()
  })

  it('greys out the Edit link while the site is read-only', async () => {
    fakeApi({
      '/api/v1/me': { user: null, readOnly: true, publicRead: true },
      '/api/v1/projects/DEMO': { project: admin, notebooks: [] },
    })
    await renderAt('/projects/DEMO')

    expect(await screen.findByRole('button', { name: 'Edit project' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('starts with its details, and sends only those changed', async () => {
    const fetchMock = fakeApi({
      '/api/v1/projects/DEMO': { project: admin, notebooks: [] },
      'PATCH /api/v1/projects/DEMO': { project: { ...admin, title: 'Renamed' }, changed: true },
    })
    await renderAt('/projects/DEMO/edit')

    const title = await screen.findByLabelText('Title')
    expect(title).toHaveValue('Example project')
    expect(screen.getByText("It's used in addresses, so it can't be changed.")).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Public/ })).toBeChecked()
    await userEvent.clear(title)
    await userEvent.type(title, 'Renamed')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await screen.findByRole('heading', { level: 1, name: 'Example project' })
    expect(sentBody(fetchMock, 'PATCH', '/api/v1/projects/DEMO')).toEqual({ title: 'Renamed' })
  })

  it('changes its credit', async () => {
    const fetchMock = fakeApi({
      '/api/v1/projects/DEMO': { project: admin, notebooks: [] },
      'PATCH /api/v1/projects/DEMO': { project: { ...admin, licence: 'CC0' }, changed: true },
    })
    await renderAt('/projects/DEMO/edit')

    await userEvent.type(await screen.findByLabelText(/Licence/), 'CC0')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await screen.findByRole('heading', { level: 1, name: 'Example project' })
    expect(sentBody(fetchMock, 'PATCH', '/api/v1/projects/DEMO')).toEqual({ licence: 'CC0' })
  })

  it('says what is wrong with a change the API refuses', async () => {
    fakeApi({
      '/api/v1/projects/DEMO': { project: admin, notebooks: [] },
      'PATCH /api/v1/projects/DEMO': Response.json(
        {
          error: 'The request has problems',
          problems: [{ path: 'title', message: 'should be text that is not empty' }],
        },
        { status: 422 },
      ),
    })
    await renderAt('/projects/DEMO/edit')

    await userEvent.clear(await screen.findByLabelText('Title'))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(
      await screen.findByText('The title should be text that is not empty.'),
    ).toBeInTheDocument()
  })

  it('tells others they cannot change it', async () => {
    fakeApi({ '/api/v1/projects/DEMO': { project, notebooks: [] } })
    await renderAt('/projects/DEMO/edit')

    expect(
      await screen.findByText("Only the project's admins can change its details."),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
  })
})

describe('editing a notebook', () => {
  it('offers an Edit link to those who can change it', async () => {
    fakeApi({ [`/api/v1/notebooks/${notebook.id}`]: notebookAnswer })
    await renderAt(`/notebooks/${notebook.id}`)

    expect(await screen.findByRole('link', { name: 'Edit notebook' })).toHaveAttribute(
      'href',
      `/notebooks/${notebook.id}/edit`,
    )
  })

  it('sends only the details changed', async () => {
    const fetchMock = fakeApi({
      [`/api/v1/notebooks/${notebook.id}`]: notebookAnswer,
      [`PATCH /api/v1/notebooks/${notebook.id}`]: { notebook: ownNotebook, changed: true },
    })
    await renderAt(`/notebooks/${notebook.id}/edit`)

    const description = await screen.findByLabelText(/Description/)
    await userEvent.type(description, ' for the p53 study')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await screen.findByRole('link', { name: 'Edit notebook' })
    expect(sentBody(fetchMock, 'PATCH', `/api/v1/notebooks/${notebook.id}`)).toEqual({
      description: `${notebook.description} for the p53 study`,
    })
  })
})
