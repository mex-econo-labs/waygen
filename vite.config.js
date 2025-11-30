import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import commonjs from 'vite-plugin-commonjs'

export default defineConfig({
  plugins: [
    react(),
    commonjs()
  ],
  define: {
    // REMOVED 'require' from here.
    // Keep 'process' as it is safe and often needed.
    'process': { env: {}, argv: [] },
    global: 'window',
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          mapbox: ['mapbox-gl', '@mapbox/mapbox-gl-draw', '@mapbox/mapbox-gl-geocoder'],
          turf: ['@turf/turf'],
          utils: ['jszip', 'file-saver'],
          vendor: ['react', 'react-dom', 'zustand', 'lucide-react']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['mapbox-gl-draw-circle']
  }
})