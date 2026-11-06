import mongoose from 'mongoose'
import { describe, expect, it } from 'vitest'

import { entryView, projectView, type People } from '../../src/http/views.ts'

// The views on their own, for details the API tests don't reach (see http/views.ts)

const when = new Date('2026-11-06T12:00:00.000Z')
const access = { yourRole: null, canContribute: false, canManageMembers: false }

describe('projectView', () => {
  it('shows each link, with null for the details a link leaves out', () => {
    const view = projectView(
      {
        code: 'LAB',
        title: 'Lab',
        description: '',
        publicRead: false,
        links: [
          {
            system: 'protolims',
            kind: 'project',
            externalId: 'P1',
            url: 'https://protolims.org/projects/P1',
            label: 'ProtoLIMS project',
          },
          { system: 'web', kind: 'page', url: 'https://example.org' },
        ],
        createdAt: when,
        updatedAt: when,
      },
      access,
    )

    expect(view.links).toEqual([
      {
        system: 'protolims',
        kind: 'project',
        externalId: 'P1',
        url: 'https://protolims.org/projects/P1',
        label: 'ProtoLIMS project',
      },
      { system: 'web', kind: 'page', externalId: null, url: 'https://example.org', label: null },
    ])
  })
})

describe('entryView', () => {
  it('names the co-authors, and anyone it can’t find as an unknown person', () => {
    const [author, coAuthor, missing] = [0, 1, 2].map(() => new mongoose.Types.ObjectId())
    const people: People = new Map([
      [author!.toHexString(), { name: 'Author', orcid: '0000-0002-1825-0097' }],
      [coAuthor!.toHexString(), { name: 'Co-author', orcid: '0000-0002-1694-233X' }],
    ])

    const view = entryView(
      {
        code: 'ELN-2026-0001',
        kind: 'experiment',
        title: 'Western blot',
        status: 'draft',
        authorId: author!,
        coAuthorIds: [coAuthor!, missing!],
        latestVersion: 0,
        contentFormat: 'protoeln-doc/1',
        content: { type: 'doc', content: [] },
        text: '',
        tags: [],
        entities: [],
        createdAt: when,
        updatedAt: when,
      },
      people,
      false,
    )

    expect(view.coAuthors).toEqual([
      { name: 'Co-author', orcid: '0000-0002-1694-233X' },
      { name: 'Unknown person', orcid: null },
    ])
    expect(view.contentPeople).toEqual({})
  })
})
