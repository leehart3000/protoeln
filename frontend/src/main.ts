import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import '@fontsource-variable/ibm-plex-sans'
import '@fontsource-variable/manrope'
import '@fontsource-variable/source-code-pro'
import './index.css'

const app = createApp(App)

app.use(router)

app.mount('#app')
