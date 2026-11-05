import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromProseMirror, type DocNode, type TableNode } from '@protoeln/content'

// The entry page loads the editor only when Edit is clicked. Loading it here first means
// the first test that opens it doesn't wait for the editor's code to be read and compiled.
import '../components/EntryEditor.vue'

import { notebook, protocol, versions } from './fixtures'
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
})
