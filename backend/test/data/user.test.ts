import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { UserModel } from '../../src/data/models/user.ts'
import { clearDatabase, startDatabase, stopDatabase, validationErrors } from '../database.ts'

beforeAll(startDatabase)
afterEach(clearDatabase)
afterAll(stopDatabase)

describe('UserModel', () => {
  it('saves a user, who is not a site admin by default', async () => {
    const user = await UserModel.create({ orcid: '0000-0002-1825-0097', name: 'Josiah Carberry' })

    expect(user.siteAdmin).toBe(false)
    expect(user.createdAt).toBeInstanceOf(Date)
  })

  it('rejects an invalid ORCID iD', async () => {
    const errors = await validationErrors(
      new UserModel({ orcid: '0000-0002-1825-0098', name: 'Someone' }),
    )

    expect(errors.orcid?.message).toBe('0000-0002-1825-0098 is not a valid ORCID iD')
  })

  it('requires a name', async () => {
    const errors = await validationErrors(new UserModel({ orcid: '0000-0002-1825-0097' }))

    expect(errors.name).toBeDefined()
  })

  it('allows only one user per ORCID iD', async () => {
    await UserModel.create({ orcid: '0000-0002-1825-0097', name: 'Josiah Carberry' })

    await expect(
      UserModel.create({ orcid: '0000-0002-1825-0097', name: 'Someone else' }),
    ).rejects.toThrow(/duplicate key/)
  })
})
