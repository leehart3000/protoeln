import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { render } from '@testing-library/vue'
import { vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import App from '../App.vue'
import { routes } from '../router'

// Replaces fetch with a fake API that gives each request its answer (a Response, or anything
// else as JSON). Reading requests are found by address ('/api/v1/projects'), others by method
// and address ('POST /api/v1/projects'). No one is signed in (on a site that shows public
// projects to everyone, and can be changed), and anything else is "not found".
export function fakeApi(answers: Record<string, unknown>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const answer = answers[method === 'GET' ? url : `${method} ${url}`]
    if (answer instanceof Response) return answer
    if (answer !== undefined) return Response.json(answer)
    if (url === '/api/v1/me') {
      return Response.json({ user: null, readOnly: false, publicRead: true })
    }
    return Response.json({ error: 'Not found' }, { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// The details a request sent, from the fake API's record of the calls
export function sentBody(fetchMock: ReturnType<typeof fakeApi>, method: string, url: string) {
  const call = fetchMock.mock.calls.find(([u, init]) => u === url && init?.method === method)
  return call ? (JSON.parse(String(call[1]?.body)) as unknown) : undefined
}

// Shows the whole site at an address, as a browser would
export async function renderAt(path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)
  await router.isReady()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(App, { global: { plugins: [router, [VueQueryPlugin, { queryClient }]] } })
}
