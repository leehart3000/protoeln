import { AwsClient } from 'aws4fetch'

import type { FileStore } from './store.ts'

// Keeps files in an S3-compatible object store, such as Cloudflare R2 (which ProtoELN uses),
// Amazon S3 or MinIO, signing each request with the store's access key (AWS Signature
// Version 4). Buckets are addressed by path (https://ENDPOINT/BUCKET/KEY), which all three
// support.
//
// Files over PART_BYTES are sent in parts (a multipart upload), so a large file doesn't depend
// on one long request. Any request that fails on the way (the connection drops, or the store
// has a passing problem: a 5xx or 429 answer) is tried again, up to ATTEMPTS times in all,
// waiting a little longer each time; a part that fails is sent again on its own.

// Every part but the last must be the same size, and at least 5 MiB (S3's and R2's minimum)
export const PART_BYTES = 5 * 1024 * 1024
const ATTEMPTS = 4

export interface S3Settings {
  // Such as https://ACCOUNT_ID.r2.cloudflarestorage.com, or https://s3.eu-west-1.amazonaws.com
  endpoint: string
  bucket: string
  // "auto" for R2; the bucket's region for Amazon S3
  region: string
  accessKeyId: string
  secretAccessKey: string
}

// A passing problem, worth trying again: the store is busy or briefly unwell
function passing(response: Response) {
  return response.status >= 500 || response.status === 429
}

export function s3Store(
  settings: S3Settings,
  fetchImpl: typeof fetch = fetch,
  // How long to wait before the first retry; each later wait is twice as long
  retryDelayMs = 1000,
): FileStore {
  const client = new AwsClient({
    accessKeyId: settings.accessKeyId,
    secretAccessKey: settings.secretAccessKey,
    service: 's3',
    region: settings.region,
    retries: 2,
  })
  const base = `${settings.endpoint.replace(/\/+$/, '')}/${encodeURIComponent(settings.bucket)}`
  const address = (key: string) => `${base}/${key.split('/').map(encodeURIComponent).join('/')}`

  // Sends a request (signed afresh each time), trying again after a dropped connection or a
  // passing problem; the last answer, or failure, is the result
  async function send(key: string, init: RequestInit, query = '') {
    for (let attempt = 1; ; attempt += 1) {
      try {
        const request = await client.sign(address(key) + query, init)
        const response = await fetchImpl(request)
        if (!passing(response) || attempt === ATTEMPTS) return response
      } catch (error) {
        if (attempt === ATTEMPTS) throw error
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * 2 ** (attempt - 1)))
    }
  }

  // Sends a large file in parts: the store gives an upload id, each part is sent on its own,
  // and the store then joins them in order. If anything fails, the upload is abandoned, so
  // the store doesn't keep the parts.
  async function putInParts(key: string, body: Uint8Array<ArrayBuffer>, contentType: string) {
    const started = await send(
      key,
      { method: 'POST', headers: { 'Content-Type': contentType } },
      '?uploads',
    )
    const uploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(await started.text())?.[1]
    if (!started.ok || uploadId === undefined) {
      throw new Error(`The file store refused to start keeping ${key}: ${started.status}`)
    }
    const upload = `uploadId=${encodeURIComponent(uploadId)}`
    try {
      const etags: string[] = []
      for (let start = 0; start < body.byteLength; start += PART_BYTES) {
        const partNumber = etags.length + 1
        const response = await send(
          key,
          { method: 'PUT', body: body.slice(start, start + PART_BYTES) },
          `?partNumber=${partNumber}&${upload}`,
        )
        const etag = response.headers.get('ETag')
        if (!response.ok || etag === null) {
          throw new Error(`The file store refused part ${partNumber} of ${key}: ${response.status}`)
        }
        etags.push(etag)
      }
      const parts = etags
        .map((etag, at) => `<Part><PartNumber>${at + 1}</PartNumber><ETag>${etag}</ETag></Part>`)
        .join('')
      const finished = await send(
        key,
        {
          method: 'POST',
          body: `<CompleteMultipartUpload>${parts}</CompleteMultipartUpload>`,
          headers: { 'Content-Type': 'application/xml' },
        },
        `?${upload}`,
      )
      // A store can answer 200 and still report an error in what it sends back
      if (!finished.ok || (await finished.text()).includes('<Error>')) {
        throw new Error(`The file store couldn't join the parts of ${key}: ${finished.status}`)
      }
    } catch (error) {
      await send(key, { method: 'DELETE' }, `?${upload}`).catch(() => undefined)
      throw error
    }
  }

  return {
    async put(key, body, contentType) {
      if (body.byteLength > PART_BYTES) return putInParts(key, body, contentType)
      const response = await send(key, {
        method: 'PUT',
        body,
        headers: { 'Content-Type': contentType },
      })
      if (!response.ok) {
        throw new Error(`The file store refused to keep ${key}: ${response.status}`)
      }
    },
    async get(key) {
      const response = await send(key, { method: 'GET' })
      if (response.status === 404) return null
      if (!response.ok) {
        throw new Error(`The file store couldn't give ${key}: ${response.status}`)
      }
      return {
        body: new Uint8Array(await response.arrayBuffer()),
        contentType: response.headers.get('Content-Type') ?? 'application/octet-stream',
      }
    },
    async has(key) {
      const response = await send(key, { method: 'HEAD' })
      if (response.status === 404) return false
      if (!response.ok) {
        throw new Error(`The file store couldn't check ${key}: ${response.status}`)
      }
      return true
    },
  }
}
