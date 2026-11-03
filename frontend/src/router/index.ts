import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import EntryPage from '../pages/EntryPage.vue'
import HomePage from '../pages/HomePage.vue'
import NotebookPage from '../pages/NotebookPage.vue'
import NotFoundPage from '../pages/NotFoundPage.vue'
import ProjectPage from '../pages/ProjectPage.vue'

// The pages, by address. Projects and entries are found by their codes, notebooks (which have
// no code) by their id. Exported for the tests, which use the same pages with their own router.
export const routes: RouteRecordRaw[] = [
  { path: '/', component: HomePage },
  { path: '/projects/:code', component: ProjectPage, props: true },
  { path: '/notebooks/:id', component: NotebookPage, props: true },
  { path: '/entries/:code', component: EntryPage, props: true },
  { path: '/:pathMatch(.*)*', component: NotFoundPage },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  // Each new page starts at the top, as a link to a new page usually does
  scrollBehavior: () => ({ top: 0 }),
})

export default router
