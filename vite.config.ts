import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/2gis': {
        target: 'https://catalog.api.2gis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/2gis/, ''),
      },
    },
  },
})
