import { afterEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

import { createApp } from '../../src/app.ts'

// How the API answers requests that go wrong before reaching a route (see http/errors.ts).
// Neither needs the database.

afterEach(() => {
  vi.restoreAllMocks()
})

describe('errors', () => {
  it('says when a request body is not valid JSON', async () => {
    const response = await request(createApp())
      .post('/api/v1/projects')
      .set('Content-Type', 'application/json')
      .send('{"code": ')

    expect(response.status).toBe(400)
    expect(response.body).toEqual({ error: 'The request body is not valid JSON' })
  })

  it('logs an unexpected error, and answers without its details', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const app = createApp({
      authenticate: async () => {
        throw new Error('Database password is hunter2')
      },
    })

    const response = await request(app).get('/api/v1/me')

    expect(response.status).toBe(500)
    expect(response.body).toEqual({ error: 'Something went wrong' })
    expect(logged).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Database password is hunter2' }),
    )
  })
})
