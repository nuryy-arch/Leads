import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('read-excel-file')) return 'excel';
            if (id.includes('lucide-react')) return 'icons';
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      '/api/2gis': {
        target: 'https://catalog.api.2gis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/2gis/, ''),
      },
      '/api/overpass': {
        target: 'https://overpass-api.de',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/overpass/, ''),
      },
    },
  },
})
