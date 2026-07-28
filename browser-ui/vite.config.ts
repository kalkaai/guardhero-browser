import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Multi-page build — all three pages in one config.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      '@mocks': resolve(__dirname, 'mocks'),
    },
  },
  build: {
    outDir: '../resources/guardhero/webui',
    rollupOptions: {
      input: {
        newtab:   resolve(__dirname, 'newtab/index.html'),
        popup:    resolve(__dirname, 'popup/index.html'),
        settings: resolve(__dirname, 'settings/index.html'),
      },
      output: {
        entryFileNames: '[name]/[name].js',
        chunkFileNames: 'shared/[name]-[hash].js',
        assetFileNames: '[name]/[name][extname]',
      },
    },
  },
  define: {
    // Allow mocking chrome.* APIs in development
    '__DEV__': JSON.stringify(process.env.NODE_ENV === 'development'),
  },
});
