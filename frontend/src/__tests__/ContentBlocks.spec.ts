import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/vue'
import type { BlockNode } from '@protoeln/content'

import ContentBlocks from '../components/ContentBlocks.vue'

// Shown on its own, without the site's router: links to entries (RouterLink) become plain links
function show(blocks: BlockNode[]) {
  return render(ContentBlocks, { props: { blocks }, global: { stubs: { RouterLink: true } } })
}

describe('ContentBlocks', () => {
  it('shows text with its marks', () => {
    show([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'H' },
          { type: 'text', text: '2', marks: [{ type: 'subscript' }] },
          { type: 'text', text: 'O is ' },
          { type: 'text', text: 'water', marks: [{ type: 'bold' }, { type: 'italic' }] },
          { type: 'text', text: ', ' },
          { type: 'text', text: 'not pursued', marks: [{ type: 'highlight' }] },
        ],
      },
    ])

    expect(screen.getByText('2').tagName).toBe('SUB')
    expect(screen.getByText('water').tagName).toBe('EM')
    expect(screen.getByText('water').parentElement?.tagName).toBe('STRONG')
    expect(screen.getByText('not pursued').tagName).toBe('MARK')
  })

  it('links only to web and email addresses, so content cannot run script', () => {
    const { container } = show([
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'a safe link',
            marks: [{ type: 'link', attrs: { href: 'https://protoeln.org' } }],
          },
          { type: 'text', text: ' and ' },
          {
            type: 'text',
            text: 'an unsafe one',
            marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
          },
        ],
      },
    ])

    // (The test library leaves out the space before the hidden words; browsers keep it)
    const safe = screen.getByRole('link', { name: /^a safe link ?\(opens in a new tab\)$/ })
    expect(safe).toHaveAttribute('href', 'https://protoeln.org')
    expect(safe).toHaveAttribute('target', '_blank')
    expect(safe).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.queryByRole('link', { name: /an unsafe one/ })).not.toBeInTheDocument()
    // The unsafe link's text is still shown, as plain text
    expect(container).toHaveTextContent('a safe link (opens in a new tab) and an unsafe one')
  })

  it('opens email links where they are, not in a new tab', () => {
    show([
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'write to us',
            marks: [{ type: 'link', attrs: { href: 'mailto:privacy@protoeln.org' } }],
          },
        ],
      },
    ])

    expect(screen.getByRole('link', { name: 'write to us' })).not.toHaveAttribute('target')
  })

  it('shows lists, including blocks inside list items', () => {
    show([
      {
        type: 'orderedList',
        attrs: { start: 3 },
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Third step' }] }],
          },
        ],
      },
    ])

    expect(screen.getByRole('list')).toHaveAttribute('start', '3')
    expect(screen.getByRole('listitem')).toHaveTextContent('Third step')
  })

  it('shows protocol steps as done or still to do', () => {
    show([
      {
        type: 'protocolStep',
        attrs: { done: true },
        content: [{ type: 'text', text: 'Mix' }],
      },
      { type: 'protocolStep', attrs: { done: false }, content: [{ type: 'text', text: 'Read' }] },
    ])

    expect(screen.getByText('Done:')).toBeInTheDocument()
    expect(screen.getByText('To do:')).toBeInTheDocument()
  })

  it('shows merged table cells merged', () => {
    const cell = (text: string, attrs?: { colspan?: number; rowspan?: number }) => ({
      type: 'tableCell' as const,
      ...(attrs && { attrs }),
      content: [{ type: 'paragraph' as const, content: [{ type: 'text' as const, text }] }],
    })
    show([
      {
        type: 'table',
        content: [
          { type: 'tableRow', content: [cell('Grid box', { colspan: 2 })] },
          { type: 'tableRow', content: [cell('A', { rowspan: 2 }), cell('B')] },
          { type: 'tableRow', content: [cell('C')] },
        ],
      },
    ])

    expect(screen.getByText('Grid box').closest('td')).toHaveAttribute('colspan', '2')
    expect(screen.getByText('A').closest('td')).toHaveAttribute('rowspan', '2')
    expect(screen.getByText('B').closest('td')).not.toHaveAttribute('colspan')
  })

  it('offers a PDF as a download, with its kind and size', () => {
    const fileId = 'f'.repeat(64)
    render(ContentBlocks, {
      props: {
        blocks: [{ type: 'fileBlock', attrs: { fileId } }],
        files: {
          [fileId]: { name: 'DMK171-1-A.pdf', contentType: 'application/pdf', size: 41_000 },
        },
      },
      global: { stubs: { RouterLink: true } },
    })

    expect(screen.getByRole('link', { name: 'DMK171-1-A.pdf' })).toHaveAttribute(
      'download',
      'DMK171-1-A.pdf',
    )
    expect(screen.getByText('(PDF, 41 kB)')).toBeInTheDocument()
  })

  it('offers a spreadsheet as a download, with its name, kind and size', () => {
    const fileId = 'd'.repeat(64)
    render(ContentBlocks, {
      props: {
        blocks: [{ type: 'fileBlock', attrs: { fileId, caption: 'Raw data' } }],
        files: {
          [fileId]: {
            name: 'TOC004A04.xls',
            contentType: 'application/vnd.ms-excel',
            size: 2_300_000,
          },
        },
      },
      global: { stubs: { RouterLink: true } },
    })

    const link = screen.getByRole('link', { name: 'TOC004A04.xls' })
    expect(link).toHaveAttribute('href', `/api/v1/files/${fileId}`)
    expect(link).toHaveAttribute('download', 'TOC004A04.xls')
    expect(screen.getByText('(Excel spreadsheet (older format), 2.3 MB)')).toBeInTheDocument()
    expect(screen.getByText('Raw data')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows an image from the API, with its description and caption', () => {
    const fileId = 'a'.repeat(64)
    show([{ type: 'fileBlock', attrs: { fileId, alt: 'A gel', caption: 'Figure 1' } }])

    expect(screen.getByRole('img', { name: 'A gel' })).toHaveAttribute(
      'src',
      `/api/v1/files/${fileId}`,
    )
    expect(screen.getByText('Figure 1').tagName).toBe('FIGCAPTION')
  })

  it("says so when an image can't be shown", async () => {
    show([
      { type: 'fileBlock', attrs: { fileId: 'b'.repeat(64), alt: 'A gel' } },
      { type: 'fileBlock', attrs: { fileId: '../not-a-file' } },
    ])

    await fireEvent.error(screen.getByRole('img', { name: 'A gel' }))

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getAllByText(/This image can't be shown here/)).toHaveLength(2)
    expect(screen.getByText(/It shows: A gel/)).toBeInTheDocument()
  })
})
