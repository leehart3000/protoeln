import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/vue'

import { notebook, project, protocol, protocolSummary, versions } from './fixtures'

const where = {
  project: { code: 'DEMO', title: 'Example project' },
  notebook: { id: notebook.id, title: notebook.title },
}
import { fakeApi, renderAt } from './helpers'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('home page', () => {
  it('has a card for each kind of record, saying how many there are', async () => {
    fakeApi({
      '/api/v1/projects': [project],
      '/api/v1/notebooks': [{ ...notebook, project: where.project }],
      '/api/v1/entries': [],
    })
    await renderAt('/')

    expect(await screen.findByRole('link', { name: '1 Project' })).toHaveAttribute(
      'href',
      '/projects',
    )
    expect(await screen.findByRole('link', { name: '1 Notebook' })).toHaveAttribute(
      'href',
      '/notebooks',
    )
    expect(await screen.findByRole('link', { name: '0 Entries' })).toHaveAttribute(
      'href',
      '/entries',
    )
  })
})

describe('projects page', () => {
  it('shows a loading message, then the projects, each linking to its page', async () => {
    fakeApi({ '/api/v1/projects': [project] })
    await renderAt('/projects')

    expect(screen.getByText('Loading projects…')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Example project' })).toHaveAttribute(
      'href',
      '/projects/DEMO',
    )
    expect(screen.getByText('Public')).toBeInTheDocument()
  })

  it('says when there are no projects to see', async () => {
    fakeApi({ '/api/v1/projects': [] })
    await renderAt('/projects')

    expect(await screen.findByText(/There are no projects you can see yet/)).toBeInTheDocument()
  })

  it('says when the projects could not be loaded', async () => {
    fakeApi({ '/api/v1/projects': new Response('', { status: 500 }) })
    await renderAt('/projects')

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the projects")
  })
})

describe('project page', () => {
  it('shows the project and its notebooks', async () => {
    fakeApi({ '/api/v1/projects/DEMO': { project, notebooks: [notebook] } })
    await renderAt('/projects/DEMO')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Example project' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Protein assays' })).toHaveAttribute(
      'href',
      `/notebooks/${notebook.id}`,
    )
    expect(screen.getByText('Josiah Carberry')).toBeInTheDocument()
  })

  it('says a project is not found, which is also what private projects show', async () => {
    fakeApi({})
    await renderAt('/projects/SECRET')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Project not found' }),
    ).toBeInTheDocument()
  })
})

describe('notebook page', () => {
  it('lists the entries, with a trail back to the project', async () => {
    fakeApi({
      [`/api/v1/notebooks/${notebook.id}`]: {
        notebook,
        project: where.project,
        entries: [protocolSummary],
      },
    })
    await renderAt(`/notebooks/${notebook.id}`)

    expect(
      await screen.findByRole('link', { name: 'Bradford assay for total protein' }),
    ).toHaveAttribute('href', '/entries/ELN-2026-0001')
    const row = screen.getByRole('link', { name: 'Bradford assay for total protein' }).closest('tr')
    expect(within(row!).getByText('Protocol')).toBeInTheDocument()
    expect(within(row!).getByText('Draft')).toBeInTheDocument()
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(trail).getByRole('link', { name: 'DEMO' })).toHaveAttribute(
      'href',
      '/projects/DEMO',
    )
  })
})

describe('lists of every notebook and entry', () => {
  it('lists every notebook, saying which project each is in', async () => {
    fakeApi({ '/api/v1/notebooks': [{ ...notebook, project: where.project }] })
    await renderAt('/notebooks')

    const link = await screen.findByRole('link', { name: 'Protein assays' })
    expect(link).toHaveAttribute('href', `/notebooks/${notebook.id}`)
    expect(link.closest('tr')).toHaveTextContent('DEMO')
  })

  it('lists every entry, saying where each is', async () => {
    fakeApi({ '/api/v1/entries': [{ ...protocolSummary, ...where }] })
    await renderAt('/entries')

    const link = await screen.findByRole('link', { name: 'Bradford assay for total protein' })
    expect(link).toHaveAttribute('href', '/entries/ELN-2026-0001')
    expect(link.closest('tr')).toHaveTextContent('Protein assays · DEMO')
  })
})

describe('entry page', () => {
  function answers(check: unknown) {
    return {
      '/api/v1/entries/ELN-2026-0001': {
        entry: protocol,
        notebook: { id: notebook.id, title: notebook.title },
        project: { code: 'DEMO', title: 'Example project' },
      },
      '/api/v1/entries/ELN-2026-0001/versions': versions,
      '/api/v1/entries/ELN-2026-0001/history-check': check,
    }
  }

  it('shows the entry’s content and versions, and that the history checks out', async () => {
    fakeApi(answers({ intact: true, problems: [] }))
    await renderAt('/entries/ELN-2026-0001')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bradford assay for total protein' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 4, name: 'Materials' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'EX-0042' })).toBeInTheDocument()
    expect(screen.getByText('To do:')).toBeInTheDocument()
    expect(screen.getByText('Read absorbance at 595 nm.')).toBeInTheDocument()
    expect(await screen.findByText('First version')).toBeInTheDocument()
    expect(screen.getByTitle(versions[0]!.hash)).toHaveTextContent(/^a1b2c3d$/)
    expect(
      await screen.findByText(/The history checks out: every version still matches/),
    ).toBeInTheDocument()
  })

  it('warns when a version has been changed since it was made', async () => {
    fakeApi(
      answers({
        intact: false,
        problems: ['Version 1 has been changed since it was created'],
      }),
    )
    await renderAt('/entries/ELN-2026-0001')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Version 1 has been changed since it was created',
    )
  })

  it('says an entry is not found', async () => {
    fakeApi({})
    await renderAt('/entries/ELN-2026-9999')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Entry not found' }),
    ).toBeInTheDocument()
  })
})

describe('other addresses', () => {
  it('says the page is not found', async () => {
    fakeApi({})
    await renderAt('/nowhere')

    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  })
})
