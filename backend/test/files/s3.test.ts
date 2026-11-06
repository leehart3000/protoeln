import { describe, expect, it } from 'vitest'

import { s3Store } from '../../src/files/s3.ts'

// The S3 store, against a fake object store that records each request it's sent

function fakeS3(answer: (request: Request) => Response) {
  const requests: Request[] = []
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    requests.push(request)
    return answer(request)
  }) as typeof fetch
  const store = s3Store(
    {
      endpoint: 'https://account.r2.cloudflarestorage.com/',
      bucket: 'protoeln-files',
      region: 'auto',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    },
    fetchImpl,
  )
  return { store, requests }
}

describe('s3Store', () => {
  it('keeps a file with a signed PUT, addressing the bucket by path', async () => {
    const { store, requests } = fakeS3(() => new Response(null, { status: 200 }))

    await store.put('files/sha256/abc', new Uint8Array([1, 2, 3]), 'image/png')

    const [request] = requests
    expect(request!.method).toBe('PUT')
    expect(request!.url).toBe(
      'https://account.r2.cloudflarestorage.com/protoeln-files/files/sha256/abc',
    )
    expect(request!.headers.get('Content-Type')).toBe('image/png')
    expect(request!.headers.get('Authorization')).toMatch(
      /^AWS4-HMAC-SHA256 Credential=key\/\d{8}\/auto\/s3\/aws4_request/,
    )
  })

  it('gives a file back, or null if there is none', async () => {
    const { store } = fakeS3((request) =>
      request.url.endsWith('/here')
        ? new Response(new Uint8Array([7, 8]), { headers: { 'Content-Type': 'image/png' } })
        : new Response(null, { status: 404 }),
    )

    expect(await store.get('here')).toEqual({
      body: new Uint8Array([7, 8]),
      contentType: 'image/png',
    })
    expect(await store.get('missing')).toBeNull()
    expect(await store.has('here')).toBe(true)
    expect(await store.has('missing')).toBe(false)
  })

  it('fails loudly when the store refuses', async () => {
    const { store } = fakeS3(() => new Response(null, { status: 403 }))

    await expect(store.put('x', new Uint8Array([1]), 'image/png')).rejects.toThrow(/403/)
    await expect(store.get('x')).rejects.toThrow(/403/)
  })
})
