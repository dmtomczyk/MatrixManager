import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(process.cwd(), 'frontend/ui/src'),
    },
  },
  plugins: [react()],
  root: resolve(process.cwd(), 'frontend/ui'),
  css: {
    postcss: resolve(process.cwd(), 'frontend/ui/postcss.config.cjs'),
  },
  server: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/login': 'http://127.0.0.1:8000',
      '/logout': 'http://127.0.0.1:8000',
      '/organizations': 'http://127.0.0.1:8000',
      '/employees': 'http://127.0.0.1:8000',
      '/projects': 'http://127.0.0.1:8000',
      '/assignments': 'http://127.0.0.1:8000',
      '/dashboard-api': 'http://127.0.0.1:8000',
      '/static': 'http://127.0.0.1:8000',
    },
  },
  build: {
    outDir: resolve(process.cwd(), 'app/static/ui-react'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(process.cwd(), 'frontend/ui/index.html'),
      output: {
        entryFileNames: 'ui-react.js',
        chunkFileNames: 'ui-react-[name].js',
        assetFileNames: (assetInfo) => assetInfo.name && assetInfo.name.endsWith('.css') ? 'ui-react.css' : 'ui-react-[name][extname]',
      },
    },
  },
});
