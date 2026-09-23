import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const shared = path.resolve(__dirname, '../../packages/shared/src');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@amar/shared': path.join(shared, 'index.ts'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    // The shared package lives outside this app's root.
    fs: { allow: [path.resolve(__dirname, '../..')] },
    proxy: {
      // Keeps the browser on one origin in dev, so nothing depends on CORS.
      '/v1': { target: 'http://localhost:4000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:4000', changeOrigin: true },
      '/health': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Leaflet is large and changes rarely — its own chunk keeps the app
        // bundle cacheable across deploys.
        manualChunks: {
          leaflet: ['leaflet', 'leaflet.markercluster'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
