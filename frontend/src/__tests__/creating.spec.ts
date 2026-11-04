import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import { notebook, project, protocol } from './fixtures'
import { fakeApi, renderAt, sentBody } from './helpers'

function someone(siteAdmin: boolean) {
  return {
    user: {
      name: 'Jo Bloggs',
      orcid: '0009-0009-7608-4486',
      orcidUrl: 'https://sandbox.orcid.org/0009-0009-7608-4486',
      siteAdmin,
      since: '2026-11-03T17:00:00.000Z',
      roles: [],
    },
  }
}

const newProject = {
  ...project,
  code: 'LAB2',
  title: 'Lab two',
  publicRead: false,
  yourRole: 'admin',
  canContribute: true,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('creating a project', () => {
  it('offers site admins an "Add" button by the heading, and a "New project" one below', async () => {
    fakeApi({ '/api/v1/me': someone(true), '/api/v1/projects': [project] })
    await renderAt('/projects')

    expect(await screen.findByRole('link', { name: 'Add project' })).toHaveTextContent('Add')
    expect(screen.getByRole('link', { name: 'Add project' })).toHaveAttribute(
      'href',
      '/projects/new',
    )
    expect(screen.getByRole('link', { name: 'New project' })).toHaveAttribute(
      'href',
      '/projects/new',
    )
  })

  it.each([
    ['someone not signed in', { user: null }, 'Sign in to do this.'],
    ['someone who is not a site admin', someone(false), 'Only site admins can do this.'],
  ])('shows %s the buttons disabled, saying why', async (_who, me, reason) => {
    fakeApi({ '/api/v1/me': me, '/api/v1/projects': [project] })
    await renderAt('/projects')

    const button = await screen.findByRole('button', { name: 'New project' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAccessibleDescription(reason)
    expect(screen.queryByRole('link', { name: 'New project' })).not.toBeInTheDocument()
  })

  it('lets a site admin create a project, then shows it', async () => {
    const fetchMock = fakeApi({
      '/api/v1/me': someone(true),
      'POST /api/v1/projects': newProject,
      '/api/v1/projects/LAB2': { project: newProject, notebooks: [] },
    })
    const user = userEvent.setup()
    await renderAt('/projects/new')

    await user.type(await screen.findByLabelText('Code'), 'LAB2')
    await user.type(screen.getByLabelText('Title'), 'Lab two')
    await user.click(screen.getByRole('button', { name: 'Create project' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Lab two' })).toBeInTheDocument()
    expect(sentBody(fetchMock, 'POST', '/api/v1/projects')).toEqual({
      code: 'LAB2',
      title: 'Lab two',
      description: '',
      publicRead: false,
    })
  })

  it('shows what is wrong with the details', async () => {
    fakeApi({
      '/api/v1/me': someone(true),
      'POST /api/v1/projects': Response.json(
        {
          error: 'The request has problems',
          problems: [{ path: 'code', message: 'should be 2 to 10 capital letters and digits' }],
        },
        { status: 422 },
      ),
    })
    const user = userEvent.setup()
    await renderAt('/projects/new')

    await user.type(await screen.findByLabelText('Code'), 'lab')
    await user.click(screen.getByRole('button', { name: 'Create project' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Please correct the problems below')
    expect(
      screen.getByText('The code should be 2 to 10 capital letters and digits.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Code')).toHaveAttribute('aria-invalid', 'true')
  })

  it('tells anyone else that only site admins can create projects', async () => {
    fakeApi({ '/api/v1/me': someone(false) })
    await renderAt('/projects/new')

    expect(await screen.findByText('Only site admins can create projects.')).toBeInTheDocument()
  })
})

describe('creating a notebook', () => {
  it('creates a notebook in the project, then opens it', async () => {
    const memberProject = { ...project, yourRole: 'contributor', canContribute: true }
    const fetchMock = fakeApi({
      '/api/v1/me': someone(false),
      '/api/v1/projects/DEMO': { project: memberProject, notebooks: [] },
      'POST /api/v1/projects/DEMO/notebooks': notebook,
      [`/api/v1/notebooks/${notebook.id}`]: {
        notebook,
        project: { code: 'DEMO', title: 'Example project', canContribute: true },
        entries: [],
      },
    })
    const user = userEvent.setup()
    await renderAt('/projects/DEMO/notebooks/new')

    await user.type(await screen.findByLabelText('Title'), 'Protein assays')
    await user.click(screen.getByRole('button', { name: 'Create notebook' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Protein assays' }),
    ).toBeInTheDocument()
    expect(sentBody(fetchMock, 'POST', '/api/v1/projects/DEMO/notebooks')).toEqual({
      title: 'Protein assays',
      description: '',
    })
  })
})

describe('creating an entry', () => {
  const notebookAnswer = {
    notebook,
    project: { code: 'DEMO', title: 'Example project', canContribute: true },
    entries: [],
  }

  it('offers members a "New entry" button on the notebook', async () => {
    fakeApi({ [`/api/v1/notebooks/${notebook.id}`]: notebookAnswer })
    await renderAt(`/notebooks/${notebook.id}`)

    expect(await screen.findByRole('link', { name: 'New entry' })).toHaveAttribute(
      'href',
      `/notebooks/${notebook.id}/entries/new`,
    )
  })

  it('creates an entry of the chosen kind, then opens it', async () => {
    const fetchMock = fakeApi({
      [`/api/v1/notebooks/${notebook.id}`]: notebookAnswer,
      [`POST /api/v1/notebooks/${notebook.id}/entries`]: protocol,
      '/api/v1/entries/ELN-2026-0001': {
        entry: protocol,
        notebook: { id: notebook.id, title: notebook.title },
        project: { code: 'DEMO', title: 'Example project' },
      },
    })
    const user = userEvent.setup()
    await renderAt(`/notebooks/${notebook.id}/entries/new`)

    await user.click(await screen.findByRole('radio', { name: /Protocol/ }))
    await user.type(screen.getByLabelText('Title'), 'Bradford assay for total protein')
    await user.click(screen.getByRole('button', { name: 'Create entry' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bradford assay for total protein' }),
    ).toBeInTheDocument()
    expect(sentBody(fetchMock, 'POST', `/api/v1/notebooks/${notebook.id}/entries`)).toEqual({
      kind: 'protocol',
      title: 'Bradford assay for total protein',
    })
  })
})
