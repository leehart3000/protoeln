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
        ],
      },
    ])

    expect(screen.getByText('2').tagName).toBe('SUB')
    expect(screen.getByText('water').tagName).toBe('EM')
    expect(screen.getByText('water').parentElement?.tagName).toBe('STRONG')
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

    expect(screen.getByRole('link', { name: 'a safe link' })).toHaveAttribute(
      'href',
      'https://protoeln.org',
    )
    expect(screen.queryByRole('link', { name: 'an unsafe one' })).not.toBeInTheDocument()
    // The unsafe link's text is still shown, as plain text
    expect(container).toHaveTextContent('a safe link and an unsafe one')
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
