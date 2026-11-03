import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { render } from '@testing-library/vue'
import { vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import App from '../App.vue'
import { routes } from '../router'

// Replaces fetch with a fake API that gives each address its answer (a Response, or anything
// else as JSON). No one is signed in, and every other address is "not found".
export function fakeApi(answers: Record<string, unknown>) {
  const fetchMock = vi.fn(async (url: string) => {
    const answer = answers[url]
    if (answer instanceof Response) return answer
    if (answer !== undefined) return Response.json(answer)
    if (url === '/api/v1/me') return Response.json({ user: null })
    return Response.json({ error: 'Not found' }, { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// Shows the whole site at an address, as a browser would
export async function renderAt(path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)
  await router.isReady()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(App, { global: { plugins: [router, [VueQueryPlugin, { queryClient }]] } })
}
