import { defineConfig } from 'vite';

// Relative URLs and unhashed file names, so `dist/` can be opened from any
// path and republished to the same artifact without leaving stale chunks behind.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 800,   // three.js is one lazily loaded chunk
    rollupOptions: {
      output: {
        entryFileNames: 'app.js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name][extname]',
      },
    },
  },
});
