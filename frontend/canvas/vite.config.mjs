import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  root: resolve(process.cwd(), 'frontend/canvas'),
  build: {
    outDir: resolve(process.cwd(), 'app/static/canvas-react'),
    emptyOutDir: true,
    manifest: false,
    rollupOptions: {
      input: resolve(process.cwd(), 'frontend/canvas/index.html'),
      output: {
        entryFileNames: 'canvas-react.js',
        chunkFileNames: 'canvas-react-[name].js',
        assetFileNames: (assetInfo) => assetInfo.name && assetInfo.name.endsWith('.css') ? 'canvas-react.css' : 'canvas-react-[name][extname]',
      },
    },
  },
});
