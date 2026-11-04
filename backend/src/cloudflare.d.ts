// The few parts of the Cloudflare Workers runtime that worker.ts uses, described here rather
// than through @cloudflare/workers-types, whose browser-style globals clash with Node.js's in
// the rest of the backend. See https://developers.cloudflare.com/workers/runtime-apis/

declare module 'cloudflare:workers' {
  // A Durable Object: a single instance that keeps its state (here, the MongoDB connection)
  // between requests
  export abstract class DurableObject<Env = unknown> {
    protected ctx: DurableObjectState
    protected env: Env
    constructor(ctx: DurableObjectState, env: Env)
  }
}

declare module 'cloudflare:node' {
  // Passes a request to the Node.js HTTP server listening on `port` in this Worker
  export function handleAsNodeRequest(port: number, request: Request): Promise<Response>
}

interface DurableObjectState {
  // Holds back requests until `callback` has finished (such as connecting to the database)
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>
}

interface DurableObjectId {
  toString(): string
}

interface DurableObjectStub {
  fetch(request: Request): Promise<Response>
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId
  get(id: DurableObjectId, options?: { locationHint?: string }): DurableObjectStub
}

// The website's files, served by Cloudflare
interface Fetcher {
  fetch(request: Request): Promise<Response>
}
