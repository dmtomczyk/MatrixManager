import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  root: resolve(process.cwd(), 'frontend/ui'),
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
