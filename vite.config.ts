import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages serves the site from /nourishnet/; local dev stays at /.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['recharts'],
          maps: ['leaflet', 'react-leaflet'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
