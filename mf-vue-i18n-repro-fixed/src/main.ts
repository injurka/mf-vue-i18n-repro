import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import App from './App.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: { hello: 'Hello from vue-i18n' },
  },
})

createApp(App).use(i18n).mount('#app')
