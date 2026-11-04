import mongoose from 'mongoose'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { ProjectModel } from '../../src/data/models/project.ts'
import { clearDatabase, startDatabase, stopDatabase, validationErrors } from '../database.ts'

beforeAll(startDatabase)
afterEach(clearDatabase)
afterAll(stopDatabase)

const someone = new mongoose.Types.ObjectId()

describe('ProjectModel', () => {
  it('saves a project, which is private and empty by default', async () => {
    const project = await ProjectModel.create({ code: 'ONC', title: 'Oncology' })

    expect(project.publicRead).toBe(false)
    expect(project.description).toBe('')
    expect(project.members).toHaveLength(0)
    expect(project.links).toHaveLength(0)
  })

  it.each(['onc', 'O', '1ONC', 'ONC-2', 'ABCDEFGHIJK'])('rejects the code %j', async (code) => {
    const errors = await validationErrors(new ProjectModel({ code, title: 'A project' }))

    expect(errors.code).toBeDefined()
  })

  it('allows only one project per code', async () => {
    await ProjectModel.create({ code: 'ONC', title: 'Oncology' })

    await expect(ProjectModel.create({ code: 'ONC', title: 'Another' })).rejects.toThrow(
      /duplicate key/,
    )
  })

  it('accepts members with a known role only', async () => {
    const valid = new ProjectModel({
      code: 'ONC',
      title: 'Oncology',
      members: [{ userId: someone, role: 'contributor' }],
    })
    const invalid = new ProjectModel({
      code: 'ONC',
      title: 'Oncology',
      members: [{ userId: someone, role: 'owner' }],
    })

    expect(await validationErrors(valid)).toEqual({})
    expect((await validationErrors(invalid))['members.0.role']).toBeDefined()
  })

  it('records links to records elsewhere, such as ProtoLIMS projects', async () => {
    const project = await ProjectModel.create({
      code: 'ONC',
      title: 'Oncology',
      links: [
        {
          system: 'protolims',
          kind: 'project',
          url: 'https://protolims.org/projects/example',
          label: 'Example',
          addedBy: someone,
        },
      ],
    })

    expect(project.links[0]?.addedAt).toBeInstanceOf(Date)
  })
})
