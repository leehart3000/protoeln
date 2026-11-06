import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromProseMirror, type DocNode, type TableNode } from '@protoeln/content'

// The entry page loads the editor only when Edit is clicked. Loading it here first means
// the first test that opens it doesn't wait for the editor's code to be read and compiled.
import '../components/EntryEditor.vue'

import { notebook, protocol, protocolSummary, versions } from './fixtures'
import { fakeApi, renderAt, sentBody } from './helpers'

const ENTRY = '/api/v1/entries/ELN-2026-0001'

// The entry page's requests, with the entry as given
function entryAnswers(entry: typeof protocol, more: Record<string, unknown> = {}) {
  return {
    [ENTRY]: {
      entry,
      notebook: { id: notebook.id, title: notebook.title },
      project: { code: 'DEMO', title: 'Example project' },
    },
    [`${ENTRY}/versions`]: versions,
    [`${ENTRY}/history-check`]: { intact: true, problems: [] },
    ...more,
  }
}

const mine = { ...protocol, canEdit: true }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('editing an entry', () => {
  it('offers its author Edit and Create version, and no one else', async () => {
    fakeApi(entryAnswers(mine))
    const { unmount } = await renderAt('/entries/ELN-2026-0001')

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create version' })).toBeInTheDocument()
    unmount()

    fakeApi(entryAnswers(protocol))
    await renderAt('/entries/ELN-2026-0001')
    expect(
      await screen.findByRole('heading', { level: 1, name: protocol.title }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('opens the draft in the editor, and saves it exactly as the content format holds it', async () => {
    const saved = { ...mine, title: 'Bradford assay', updatedAt: '2026-11-04T10:00:00.000Z' }
    const fetchMock = fakeApi(
      entryAnswers(mine, { [`PUT ${ENTRY}/draft`]: { entry: saved, changed: true } }),
    )
    const user = userEvent.setup()
    await renderAt('/entries/ELN-2026-0001')

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    expect(await screen.findByRole('toolbar', { name: 'Formatting' })).toBeInTheDocument()
    const title = screen.getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Bradford assay')
    expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Saved')).toBeInTheDocument()
    // Unchanged content comes back from the editor exactly as it was
    expect(sentBody(fetchMock, 'PUT', `${ENTRY}/draft`)).toEqual({
      basedOn: mine.updatedAt,
      title: 'Bradford assay',
      content: fromProseMirror(mine.content),
    })
  })

  it('says when someone else saved first, rather than overwriting their work', async () => {
    fakeApi(
      entryAnswers(mine, {
        [`PUT ${ENTRY}/draft`]: Response.json(
          { error: 'This entry has been saved by someone else since you opened it' },
          { status: 409 },
        ),
      }),
    )
    const user = userEvent.setup()
    await renderAt('/entries/ELN-2026-0001')

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.click(await screen.findByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This entry has been saved by someone else since you opened it.',
    )
  })

  it('asks before closing the editor with unsaved changes', async () => {
    fakeApi(entryAnswers(mine))
    const user = userEvent.setup()
    await renderAt('/entries/ELN-2026-0001')

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.type(await screen.findByLabelText('Title'), ' (changed)')
    await user.click(screen.getByRole('button', { name: 'Close editor' }))
    expect(screen.getByText('Close without saving your changes?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close without saving' }))

    expect(screen.queryByRole('toolbar', { name: 'Formatting' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('creates a version, with a note', async () => {
    const fetchMock = fakeApi(entryAnswers(mine, { [`POST ${ENTRY}/versions`]: versions[0] }))
    const user = userEvent.setup()
    await renderAt('/entries/ELN-2026-0001')

    await user.click(await screen.findByRole('button', { name: 'Create version' }))
    await user.type(screen.getByLabelText(/Note/), 'Results added')
    await user.click(screen.getByRole('button', { name: 'Create version' }))

    expect(sentBody(fetchMock, 'POST', `${ENTRY}/versions`)).toEqual({ note: 'Results added' })
    expect(await screen.findByRole('button', { name: 'Create version' })).not.toHaveAttribute(
      'type',
      'submit',
    )
  })

  it('offers Create version while editing, once the changes are saved', async () => {
    const saved = { ...mine, title: 'Bradford assay', updatedAt: '2026-11-04T10:00:00.000Z' }
    const fetchMock = fakeApi(
      entryAnswers(mine, {
        [`PUT ${ENTRY}/draft`]: { entry: saved, changed: true },
        [`POST ${ENTRY}/versions`]: versions[0],
      }),
    )
    const user = userEvent.setup()
    await renderAt('/entries/ELN-2026-0001')

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.type(await screen.findByLabelText('Title'), '!')
    const waiting = screen.getByRole('button', { name: 'Create version' })
    expect(waiting).toHaveAttribute('aria-disabled', 'true')
    expect(waiting).toHaveAccessibleDescription(
      'Save your changes first: a version is of the draft as last saved.',
    )

    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Saved')
    await user.click(screen.getByRole('button', { name: 'Create version' }))
    await user.type(screen.getByLabelText(/Note/), 'Title changed')
    await user.click(screen.getByRole('button', { name: 'Create version' }))

    expect(sentBody(fetchMock, 'POST', `${ENTRY}/versions`)).toEqual({ note: 'Title changed' })
  })

  it('adds a table, with rows and columns, and saves it', async () => {
    const fetchMock = fakeApi(
      entryAnswers(mine, { [`PUT ${ENTRY}/draft`]: { entry: mine, changed: true } }),
    )
    const user = userEvent.setup()
    await renderAt('/entries/ELN-2026-0001')

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.click(await screen.findByRole('button', { name: 'Table' }))
    const tools = await screen.findByRole('toolbar', { name: 'Table' })
    expect(screen.getByRole('button', { name: 'Table' })).toHaveAttribute('aria-disabled', 'true')
    await user.click(within(tools).getByRole('button', { name: 'Add row below' }))
    await user.click(within(tools).getByRole('button', { name: 'Add column right' }))
    expect(within(tools).getByRole('button', { name: 'Header row' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Saved')

    // A header row and three rows of cells, each four cells wide
    const { content } = sentBody(fetchMock, 'PUT', `${ENTRY}/draft`) as { content: DocNode }
    const table = content.content.find((block): block is TableNode => block.type === 'table')
    expect(table?.content.map((row) => row.content.map((cell) => cell.type))).toEqual([
      Array(4).fill('tableHeader'),
      Array(4).fill('tableCell'),
      Array(4).fill('tableCell'),
      Array(4).fill('tableCell'),
    ])
  })

  it('turns off a table’s header row, and deletes tables', async () => {
    fakeApi(entryAnswers(mine))
    const user = userEvent.setup()
    await renderAt('/entries/ELN-2026-0001')

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.click(await screen.findByRole('button', { name: 'Table' }))
    const tools = await screen.findByRole('toolbar', { name: 'Table' })
    const headerRow = within(tools).getByRole('button', { name: 'Header row' })
    await user.click(headerRow)
    // The editor redraws its buttons a moment after each change
    await waitFor(() => expect(headerRow).toHaveAttribute('aria-pressed', 'false'))

    // Deleting its last row deletes the table
    const deleteRow = within(tools).getByRole('button', { name: 'Delete row' })
    await user.click(deleteRow)
    await user.click(deleteRow)
    expect(screen.getByRole('toolbar', { name: 'Table' })).toBeInTheDocument()
    await user.click(deleteRow)
    await waitFor(() =>
      expect(screen.queryByRole('toolbar', { name: 'Table' })).not.toBeInTheDocument(),
    )

    // So does Delete table
    await user.click(screen.getByRole('button', { name: 'Table' }))
    const again = await screen.findByRole('toolbar', { name: 'Table' })
    await user.click(within(again).getByRole('button', { name: 'Delete table' }))
    await waitFor(() =>
      expect(screen.queryByRole('toolbar', { name: 'Table' })).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: 'Table' })).not.toHaveAttribute('aria-disabled')
  })

  it('starts an empty entry with a line to type on, which can become a protocol step', async () => {
    const empty = { ...mine, content: { type: 'doc' as const, content: [] } }
    const fetchMock = fakeApi(
      entryAnswers(empty, { [`PUT ${ENTRY}/draft`]: { entry: empty, changed: true } }),
    )
    const user = userEvent.setup()
    await renderAt('/entries/ELN-2026-0001')

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.click(await screen.findByRole('button', { name: 'Checklist' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Saved')

    expect(sentBody(fetchMock, 'PUT', `${ENTRY}/draft`)).toMatchObject({
      content: { type: 'doc', content: [{ type: 'protocolStep', attrs: { done: false } }] },
    })
  })

  it('adds materials, with their details, and saves them', async () => {
    const empty = { ...mine, content: { type: 'doc' as const, content: [] } }
    const fetchMock = fakeApi(
      entryAnswers(empty, { [`PUT ${ENTRY}/draft`]: { entry: empty, changed: true } }),
    )
    const user = userEvent.setup()
    await renderAt('/entries/ELN-2026-0001')

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.click(await screen.findByRole('button', { name: 'Materials table' }))
    // The materials table is drawn a moment after it's added, so wait until it's settled
    await screen.findByLabelText('Lot number, row 1')
    await user.type(await screen.findByLabelText('Material, row 1'), 'Coomassie dye reagent')
    await user.type(await screen.findByLabelText('Lot number, row 1'), 'EX-0042')
    await user.click(screen.getByRole('button', { name: 'Add material' }))
    await user.type(await screen.findByLabelText('Material, row 2'), 'BSA standard')
    // A detail typed, left, and then cleared is left out (not kept as empty text)
    await user.type(await screen.findByLabelText('Supplier, row 2'), 'Pierce')
    await user.click(await screen.findByLabelText('Amount, row 2'))
    await user.clear(await screen.findByLabelText('Supplier, row 2'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Saved')

    const { content } = sentBody(fetchMock, 'PUT', `${ENTRY}/draft`) as { content: unknown }
    expect(content).toEqual({
      type: 'doc',
      content: [
        {
          type: 'materials',
          attrs: {
            items: [
              { name: 'Coomassie dye reagent', lotNumber: 'EX-0042' },
              { name: 'BSA standard' },
            ],
          },
        },
      ],
    })
  })

  it('deletes a material, and the materials', async () => {
    fakeApi(entryAnswers(mine))
    const user = userEvent.setup()
    await renderAt('/entries/ELN-2026-0001')

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    expect(await screen.findByLabelText('Material, row 1')).toHaveValue('Coomassie dye reagent')
    await user.click(screen.getByRole('button', { name: 'Delete material, row 1' }))
    expect(await screen.findByText('No materials yet.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete materials' }))

    await waitFor(() => expect(screen.queryByText('No materials yet.')).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes')
  })

  it('lists what’s wrong when a save is refused for the content', async () => {
    fakeApi(
      entryAnswers(mine, {
        [`PUT ${ENTRY}/draft`]: Response.json(
          {
            error: 'The entry content is not valid',
            problems: [{ path: 'content[3].attrs', message: 'should not be there' }],
          },
          { status: 422 },
        ),
      }),
    )
    const user = userEvent.setup()
    await renderAt('/entries/ELN-2026-0001')

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.click(await screen.findByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('list', { name: 'Problems' })).toHaveTextContent(
      'content[3].attrs: should not be there',
    )
  })

  it('links to another entry, found by searching', async () => {
    const empty = { ...mine, content: { type: 'doc' as const, content: [] } }
    const other = {
      ...protocolSummary,
      code: 'ELN-2026-0003',
      title: 'Lysate prep',
      notebook: { id: notebook.id, title: notebook.title },
      project: { code: 'DEMO', title: 'Example project' },
    }
    const fetchMock = fakeApi(
      entryAnswers(empty, {
        '/api/v1/entries': [{ ...other, code: 'ELN-2026-0001', title: 'Lysate test' }, other],
        [`PUT ${ENTRY}/draft`]: { entry: empty, changed: true },
      }),
    )
    const user = userEvent.setup()
    await renderAt('/entries/ELN-2026-0001')

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.click(await screen.findByRole('button', { name: 'Link to record' }))
    // Before anything is typed, the most recently changed entries (but not this one)
    const recent = await screen.findByRole('list', { name: 'Recently changed entries' })
    expect(within(recent).getAllByRole('button')).toHaveLength(1)
    await user.type(screen.getByLabelText(/^Find an entry/), 'lysate')
    const matches = await screen.findByRole('list', { name: 'Matching entries' })
    // The entry being edited isn't offered
    expect(within(matches).getAllByRole('button')).toHaveLength(1)
    await user.click(within(matches).getByRole('button', { name: /Lysate prep/ }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Saved')

    const { content } = sentBody(fetchMock, 'PUT', `${ENTRY}/draft`) as { content: unknown }
    expect(content).toEqual({
      type: 'doc',
      content: [
        {
          type: 'recordLink',
          attrs: {
            system: 'protoeln',
            kind: 'entry',
            url: '/entries/ELN-2026-0003',
            label: 'Lysate prep',
            externalId: 'ELN-2026-0003',
          },
        },
      ],
    })
  })

  it('links to a record elsewhere, by its address', async () => {
    const empty = { ...mine, content: { type: 'doc' as const, content: [] } }
    const fetchMock = fakeApi(
      entryAnswers(empty, { [`PUT ${ENTRY}/draft`]: { entry: empty, changed: true } }),
    )
    const user = userEvent.setup()
    await renderAt('/entries/ELN-2026-0001')

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.click(await screen.findByRole('button', { name: 'Link to record' }))
    await user.type(
      screen.getByLabelText(/^Find an entry/),
      'https://lims.example.org/samples/S-0042',
    )
    await user.type(await screen.findByLabelText('Label'), 'Sample S-0042')
    expect(
      screen.getByText('Shown as: Sample S-0042 (sample on lims.example.org)'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add link' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Saved')

    const { content } = sentBody(fetchMock, 'PUT', `${ENTRY}/draft`) as { content: unknown }
    expect(content).toEqual({
      type: 'doc',
      content: [
        {
          type: 'recordLink',
          attrs: {
            system: 'lims.example.org',
            kind: 'sample',
            url: 'https://lims.example.org/samples/S-0042',
            label: 'Sample S-0042',
            externalId: 'S-0042',
          },
        },
      ],
    })
  })

  it('shows its author Edit and Create version greyed out, and no tick boxes, while read-only', async () => {
    fakeApi(entryAnswers(mine, { '/api/v1/me': { user: null, readOnly: true } }))
    await renderAt('/entries/ELN-2026-0001')

    const edit = await screen.findByRole('button', { name: 'Edit' })
    expect(edit).toHaveAttribute('aria-disabled', 'true')
    expect(edit).toHaveAccessibleDescription(
      'This site is read-only at the moment, so nothing can be changed.',
    )
    expect(screen.getByRole('button', { name: 'Create version' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
