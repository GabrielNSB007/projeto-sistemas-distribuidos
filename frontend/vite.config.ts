import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    proxy: {
      '/tasks': 'http://localhost:3000',
    },
  },
})
