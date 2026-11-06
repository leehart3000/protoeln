// Where files (such as images in entries) are kept: an object store, reached through the S3
// interface (see s3.ts), which Cloudflare R2, Amazon S3 and MinIO all offer. Others, such as
// Google Cloud Storage, can be added by implementing this interface. Each file is kept under a
// key made from its SHA-256, so a file is kept once however many entries show it, and is never
// changed.

export interface StoredFile {
  body: Uint8Array<ArrayBuffer>
  contentType: string
}

export interface FileStore {
  // Keeps the bytes under `key`
  put(key: string, body: Uint8Array<ArrayBuffer>, contentType: string): Promise<void>
  // The bytes kept under `key`, or null if there are none
  get(key: string): Promise<StoredFile | null>
  // Whether anything is kept under `key`
  has(key: string): Promise<boolean>
}

// Where a file with this SHA-256 (in hex) is kept
export function fileKey(sha256: string) {
  return `files/sha256/${sha256}`
}

// Keeps files in memory, for tests and for running locally without an object store
export function memoryStore(): FileStore {
  const files = new Map<string, StoredFile>()
  return {
    async put(key, body, contentType) {
      files.set(key, { body, contentType })
    },
    async get(key) {
      return files.get(key) ?? null
    },
    async has(key) {
      return files.has(key)
    },
  }
}
