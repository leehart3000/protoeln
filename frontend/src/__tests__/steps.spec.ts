import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import type { Entry } from '../api'
import { notebook, protocol, versions } from './fixtures'
import { fakeApi, renderAt, sentBody } from './helpers'

const ENTRY = '/api/v1/entries/ELN-2026-0001'
const CARBERRY = '0000-0002-1825-0097'
const STEP = 'Read absorbance at 595 nm.'

// The protocol, with its step (the third block) ticked by Josiah Carberry
function ticked(entry: Entry): Entry {
  const content = structuredClone(entry.content)
  content.content[2] = {
    type: 'protocolStep',
    attrs: { done: true, doneBy: CARBERRY, doneAt: '2026-11-05T17:30:00.000Z' },
    content: [{ type: 'text', text: STEP }],
  }
  return { ...entry, content, contentPeople: { [CARBERRY]: 'Josiah Carberry' } }
}

function entryAnswers(entry: Entry, more: Record<string, unknown> = {}) {
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

describe('ticking off protocol steps', () => {
  it('lets the author tick a step, saving it at once, and shows who ticked it', async () => {
    const fetchMock = fakeApi(
      entryAnswers(mine, {
        [`PUT ${ENTRY}/steps`]: {
          entry: { ...ticked(mine), updatedAt: '2026-11-05T17:30:00.000Z' },
          changed: true,
        },
      }),
    )
    const user = userEvent.setup()
    await renderAt('/entries/ELN-2026-0001')

    const box = await screen.findByRole('checkbox', { name: STEP })
    expect(box).not.toBeChecked()
    await user.click(box)

    await waitFor(() => expect(box).toBeChecked())
    expect(sentBody(fetchMock, 'PUT', `${ENTRY}/steps`)).toEqual({
      basedOn: mine.updatedAt,
      path: [2],
      done: true,
    })
    expect(screen.getByText(/^Done by Josiah Carberry, /)).toBeInTheDocument()
  })

  it('says why a tick was refused', async () => {
    fakeApi(
      entryAnswers(mine, {
        [`PUT ${ENTRY}/steps`]: Response.json(
          { error: 'This entry has been saved by someone else since you opened it' },
          { status: 409 },
        ),
      }),
    )
    const user = userEvent.setup()
    await renderAt('/entries/ELN-2026-0001')

    await user.click(await screen.findByRole('checkbox', { name: STEP }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This entry has been saved by someone else since you opened it.',
    )
    expect(screen.getByRole('checkbox', { name: STEP })).not.toBeChecked()
  })

  it('shows everyone else who ticked a step, without a tick box', async () => {
    fakeApi(entryAnswers(ticked(protocol)))
    await renderAt('/entries/ELN-2026-0001')

    expect(await screen.findByText(/^Done by Josiah Carberry, /)).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
