import { AwsClient } from 'aws4fetch'

import type { FileStore } from './store.ts'

// Keeps files in an S3-compatible object store, such as Cloudflare R2 (which ProtoELN uses),
// Amazon S3 or MinIO, signing each request with the store's access key (AWS Signature
// Version 4). Buckets are addressed by path (https://ENDPOINT/BUCKET/KEY), which all three
// support.

export interface S3Settings {
  // Such as https://ACCOUNT_ID.r2.cloudflarestorage.com, or https://s3.eu-west-1.amazonaws.com
  endpoint: string
  bucket: string
  // "auto" for R2; the bucket's region for Amazon S3
  region: string
  accessKeyId: string
  secretAccessKey: string
}

export function s3Store(settings: S3Settings, fetchImpl: typeof fetch = fetch): FileStore {
  const client = new AwsClient({
    accessKeyId: settings.accessKeyId,
    secretAccessKey: settings.secretAccessKey,
    service: 's3',
    region: settings.region,
    retries: 2,
  })
  const base = `${settings.endpoint.replace(/\/+$/, '')}/${encodeURIComponent(settings.bucket)}`
  const address = (key: string) => `${base}/${key.split('/').map(encodeURIComponent).join('/')}`

  async function send(key: string, init: RequestInit) {
    const request = await client.sign(address(key), init)
    return fetchImpl(request)
  }

  return {
    async put(key, body, contentType) {
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
