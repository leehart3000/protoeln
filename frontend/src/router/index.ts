import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import EntriesPage from '../pages/EntriesPage.vue'
import EntryPage from '../pages/EntryPage.vue'
import HomePage from '../pages/HomePage.vue'
import NotebookPage from '../pages/NotebookPage.vue'
import NotebooksPage from '../pages/NotebooksPage.vue'
import NotFoundPage from '../pages/NotFoundPage.vue'
import ProfilePage from '../pages/ProfilePage.vue'
import ProjectPage from '../pages/ProjectPage.vue'
import ProjectsPage from '../pages/ProjectsPage.vue'

// The pages, by address. Projects and entries are found by their codes, notebooks (which have
// no code) by their id. Exported for the tests, which use the same pages with their own router.
export const routes: RouteRecordRaw[] = [
  { path: '/', component: HomePage },
  { path: '/projects', component: ProjectsPage },
  { path: '/projects/:code', component: ProjectPage, props: true },
  { path: '/notebooks', component: NotebooksPage },
  { path: '/notebooks/:id', component: NotebookPage, props: true },
  { path: '/entries', component: EntriesPage },
  { path: '/entries/:code', component: EntryPage, props: true },
  { path: '/profile', component: ProfilePage },
  { path: '/:pathMatch(.*)*', component: NotFoundPage },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  // Each new page starts at the top, as a link to a new page usually does
  scrollBehavior: () => ({ top: 0 }),
})

export default router
