import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],

  server: {
    port: 3000,
    proxy: {
      '/api':   'http://localhost:8001',
      '/media': 'http://localhost:8001',
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor':     ['react', 'react-dom', 'react-router-dom'],
          'reactflow-vendor': ['@xyflow/react'],
          'ui-vendor':        ['zustand', 'axios'],
        },
      },
    },
  },

  preview: { port: 4173 },
}))
