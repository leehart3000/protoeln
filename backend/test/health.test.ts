import { describe, it, expect } from 'vitest'
import request from 'supertest'

import { createApp } from '../src/app.ts'

describe('GET /api/health', () => {
  it('reports that the API is up', async () => {
    const response = await request(createApp()).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
  })
})
