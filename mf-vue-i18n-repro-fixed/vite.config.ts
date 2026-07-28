import { federation } from '@module-federation/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue(),
    federation({
      name: 'repro_host',
      dts: false,
      shared: {
        vue: { singleton: true },
      },
    }),
  ],
})
