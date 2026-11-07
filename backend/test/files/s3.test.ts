import { describe, expect, it } from 'vitest'

import { PART_BYTES, s3Store } from '../../src/files/s3.ts'

// The S3 store, against a fake object store that records each request it's sent (and may
// throw, as fetch does when a connection drops). Retries don't wait, in tests.

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
    0,
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

  it('sends a large file in parts, and joins them in order', async () => {
    const { store, requests } = fakeS3((request) => {
      const url = new URL(request.url)
      if (url.searchParams.has('uploads')) {
        return new Response('<InitiateMultipartUploadResult><UploadId>up 1</UploadId>')
      }
      if (url.searchParams.has('partNumber')) {
        return new Response(null, { headers: { ETag: `"e${url.searchParams.get('partNumber')}"` } })
      }
      return new Response('<CompleteMultipartUploadResult></CompleteMultipartUploadResult>')
    })

    await store.put('files/big', new Uint8Array(2 * PART_BYTES + 3), 'application/pdf')

    const start = new URL(requests[0]!.url)
    expect(requests[0]!.method).toBe('POST')
    expect(start.searchParams.has('uploads')).toBe(true)
    expect(requests[0]!.headers.get('Content-Type')).toBe('application/pdf')
    const parts = requests.slice(1, 4)
    expect(parts.map((part) => new URL(part.url).searchParams.get('partNumber'))).toEqual([
      '1',
      '2',
      '3',
    ])
    expect(parts.every((part) => new URL(part.url).searchParams.get('uploadId') === 'up 1')).toBe(
      true,
    )
    const sizes = await Promise.all(
      parts.map(async (part) => (await part.arrayBuffer()).byteLength),
    )
    expect(sizes).toEqual([PART_BYTES, PART_BYTES, 3])
    const finish = requests[4]!
    expect(finish.method).toBe('POST')
    expect(new URL(finish.url).searchParams.get('uploadId')).toBe('up 1')
    expect(await finish.text()).toBe(
      '<CompleteMultipartUpload>' +
        '<Part><PartNumber>1</PartNumber><ETag>"e1"</ETag></Part>' +
        '<Part><PartNumber>2</PartNumber><ETag>"e2"</ETag></Part>' +
        '<Part><PartNumber>3</PartNumber><ETag>"e3"</ETag></Part>' +
        '</CompleteMultipartUpload>',
    )
    expect(requests).toHaveLength(5)
  })

  it('tries again when the connection drops, or the store has a passing problem', async () => {
    let calls = 0
    const { store, requests } = fakeS3(() => {
      calls += 1
      if (calls === 1) throw new TypeError('fetch failed')
      if (calls === 2) return new Response(null, { status: 503 })
      return new Response(null, { status: 200 })
    })

    await store.put('x', new Uint8Array([1]), 'image/png')

    expect(requests).toHaveLength(3)
  })

  it('gives up after a few tries, and abandons a large upload that fails', async () => {
    const { store, requests } = fakeS3((request) => {
      const url = new URL(request.url)
      if (url.searchParams.has('uploads')) {
        return new Response('<UploadId>up 2</UploadId>')
      }
      if (request.method === 'DELETE') return new Response(null, { status: 204 })
      throw new TypeError('fetch failed')
    })

    await expect(
      store.put('files/big', new Uint8Array(PART_BYTES + 1), 'application/pdf'),
    ).rejects.toThrow('fetch failed')

    // The upload started, its first part was tried four times, and then it was abandoned
    expect(requests.map((request) => request.method)).toEqual([
      'POST',
      'PUT',
      'PUT',
      'PUT',
      'PUT',
      'DELETE',
    ])
    expect(new URL(requests[5]!.url).searchParams.get('uploadId')).toBe('up 2')
  })

  it('does not try again when the store refuses', async () => {
    const { store, requests } = fakeS3(() => new Response(null, { status: 403 }))

    await expect(store.put('x', new Uint8Array([1]), 'image/png')).rejects.toThrow(/403/)
    expect(requests).toHaveLength(1)
  })
})
