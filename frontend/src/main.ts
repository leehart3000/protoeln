import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import '@fontsource-variable/ibm-plex-sans'
import '@fontsource-variable/manrope'
import '@fontsource-variable/source-code-pro'
import './index.css'

// Data from the API is kept for 30 seconds before it is fetched again, so moving between pages
// is quick (as in ProtoLIMS, which uses TanStack Query for React)
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

const app = createApp(App)

app.use(router)
app.use(VueQueryPlugin, { queryClient })

app.mount('#app')
