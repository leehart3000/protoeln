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
    expect(await screen.findByText('Public')).toBeInTheDocument()
  })

  it('shows the visitor’s role in a project as well as whether it is public', async () => {
    fakeApi({ '/api/v1/projects': [{ ...project, yourRole: 'admin' }] })
    await renderAt('/projects')

    expect(await screen.findByText('Admin')).toBeInTheDocument()
    expect(await screen.findByText('Public')).toBeInTheDocument()
  })

  it("doesn't call a project public if the site doesn't show public projects to everyone", async () => {
    fakeApi({
      '/api/v1/me': { user: null, readOnly: false, publicRead: false },
      '/api/v1/projects': [project],
    })
    await renderAt('/projects')

    await screen.findByRole('link', { name: 'Example project' })
    expect(screen.queryByText('Public')).not.toBeInTheDocument()
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
    expect(screen.getByText('Invented example data, for trying out ProtoELN.')).toBeInTheDocument()
  })

  it('gives credit for its data, with web addresses as links', async () => {
    fakeApi({
      '/api/v1/projects/DEMO': {
        project: {
          ...project,
          sourceRepository: 'https://zenodo.org/records/1',
          licence: 'CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).',
          citation: '',
        },
        notebooks: [],
      },
    })
    await renderAt('/projects/DEMO')

    expect(await screen.findByText('Source repository:')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'https://zenodo.org/records/1 (opens in a new tab)' }),
    ).toHaveAttribute('href', 'https://zenodo.org/records/1')
    // The bracket and full stop after the address aren't part of it
    expect(
      screen.getByRole('link', {
        name: 'https://creativecommons.org/licenses/by/4.0/ (opens in a new tab)',
      }),
    ).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/')
    expect(screen.queryByText('Citation:')).not.toBeInTheDocument()
  })

  it('says who can see the project, and the visitor’s role in it', async () => {
    fakeApi({
      '/api/v1/projects/DEMO': { project: { ...project, yourRole: 'admin' }, notebooks: [] },
    })
    await renderAt('/projects/DEMO')

    const details = await screen.findByRole('region', { name: 'Details' })
    expect(within(details).getByText('Public')).toBeInTheDocument()
    expect(within(details).getByText('Anyone can read it, without signing in.')).toBeInTheDocument()
    expect(within(details).getByText('Your role:').nextElementSibling).toHaveTextContent('Admin')
    expect(within(details).getByText('Code:').nextElementSibling).toHaveTextContent('DEMO')
  })

  it('calls a project private if the site doesn’t show public projects to everyone', async () => {
    fakeApi({
      '/api/v1/me': { user: null, readOnly: false, publicRead: false },
      '/api/v1/projects/DEMO': { project, notebooks: [] },
    })
    await renderAt('/projects/DEMO')

    expect(await screen.findByText('Private')).toBeInTheDocument()
    expect(screen.getByText(/It's marked public, but this site/)).toBeInTheDocument()
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
    const details = screen.getByRole('region', { name: 'Details' })
    expect(within(details).getByText('Measuring protein in cell lysates.')).toBeInTheDocument()
    expect(within(details).getByText('Kept by:').nextElementSibling).toHaveTextContent(
      'Josiah Carberry',
    )
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

  it('credits an imported entry’s source and original authors', async () => {
    const imported = {
      ...protocol,
      tags: ['huntingtin'],
      source: {
        url: 'https://zenodo.org/records/841818',
        doi: '10.5281/zenodo.841818',
        authors: ['Harding, Rachel', 'Duan, Shili'],
        publishedOn: '2017-07-19',
        licence: 'CC BY 4.0',
        citation: 'Harding, R. & Duan, S. (2017). https://doi.org/10.5281/zenodo.841818',
      },
    }
    fakeApi({
      ...answers({ intact: true, problems: [] }),
      '/api/v1/entries/ELN-2026-0001': {
        ...answers(null)['/api/v1/entries/ELN-2026-0001'],
        entry: imported,
      },
    })
    await renderAt('/entries/ELN-2026-0001')

    const details = await screen.findByRole('region', { name: 'Details' })
    expect(within(details).getByText('Imported by:').nextElementSibling).toHaveTextContent(
      'Josiah Carberry',
    )
    expect(within(details).getByText('Original authors:').nextElementSibling).toHaveTextContent(
      'Harding, Rachel; Duan, Shili',
    )
    expect(within(details).getByText('Published:').nextElementSibling).toHaveTextContent(
      '19 July 2017',
    )
    expect(
      within(details).getByRole('link', {
        name: 'https://zenodo.org/records/841818 (opens in a new tab)',
      }),
    ).toHaveAttribute('href', 'https://zenodo.org/records/841818')
    expect(within(details).getAllByRole('link', { name: /doi\.org/ })).toHaveLength(2)
    expect(within(details).getByText('huntingtin')).toBeInTheDocument()
  })

  it('names the author of an entry written here, with no source', async () => {
    fakeApi(answers({ intact: true, problems: [] }))
    await renderAt('/entries/ELN-2026-0001')

    const details = await screen.findByRole('region', { name: 'Details' })
    expect(within(details).getByText('Author:')).toBeInTheDocument()
    expect(within(details).queryByText('Source')).not.toBeInTheDocument()
  })

  it('lists the entries that link to it, and links to entries in its content', async () => {
    const linking = {
      ...protocolSummary,
      ...where,
      code: 'ELN-2026-0002',
      title: 'Blot 1',
      linkedIn: { draft: false, versions: [1, 2] },
    }
    const linked = {
      ...protocol,
      content: {
        type: 'doc' as const,
        content: [
          {
            type: 'recordLink' as const,
            attrs: {
              system: 'protoeln',
              kind: 'entry',
              url: '/entries/ELN-2026-0003',
              label: 'Lysate prep',
              externalId: 'ELN-2026-0003',
            },
          },
        ],
      },
    }
    fakeApi({
      ...answers({ intact: true, problems: [] }),
      '/api/v1/entries/ELN-2026-0001': {
        entry: linked,
        notebook: { id: notebook.id, title: notebook.title },
        project: { code: 'DEMO', title: 'Example project' },
      },
      '/api/v1/entries/ELN-2026-0001/linked-from': [linking],
    })
    await renderAt('/entries/ELN-2026-0001')

    expect(await screen.findByRole('link', { name: 'Lysate prep' })).toHaveAttribute(
      'href',
      '/entries/ELN-2026-0003',
    )
    expect(screen.getByText('(entry ELN-2026-0003)')).toBeInTheDocument()
    const heading = await screen.findByRole('heading', { name: 'Linked from' })
    const section = within(heading.closest('section')!)
    expect(section.getByRole('link', { name: 'Blot 1' })).toHaveAttribute(
      'href',
      '/entries/ELN-2026-0002',
    )
    expect(section.getByText(/^In versions 1 and 2/)).toHaveTextContent(
      'In versions 1 and 2 · Protein assays · DEMO',
    )
  })

  it('shows a version, exactly as it was made', async () => {
    fakeApi({
      ...answers({ intact: true, problems: [] }),
      '/api/v1/entries/ELN-2026-0001/versions/1': {
        ...versions[0],
        contentFormat: 'protoeln-doc/1',
        content: protocol.content,
        contentPeople: {},
        text: '',
        markdown: '',
      },
    })
    await renderAt('/entries/ELN-2026-0001/versions/1')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bradford assay for total protein' }),
    ).toBeInTheDocument()
    expect(screen.getByText(versions[0]!.hash)).toBeInTheDocument()
    expect(screen.getByText('None: this is the first version')).toBeInTheDocument()
    expect(screen.getByText('Read absorbance at 595 nm.')).toBeInTheDocument()
    // Back to the entry, in the breadcrumbs and in the sentence under the title
    const back = await screen.findAllByRole('link', { name: 'ELN-2026-0001' })
    expect(back.map((link) => link.getAttribute('href'))).toEqual([
      '/entries/ELN-2026-0001',
      '/entries/ELN-2026-0001',
    ])
  })

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
    expect(screen.getByRole('link', { name: 'Version 1' })).toHaveAttribute(
      'href',
      '/entries/ELN-2026-0001/versions/1',
    )
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
