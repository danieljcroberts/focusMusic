import { defineConfig } from 'vite';
import { readdirSync } from 'node:fs';

// The files a viewer needs to use every scene offline: the scene art and videos, the thumbnails, and (in a build) every
// code chunk. Written as offline.json, which "Save every scene for offline use" in the sheet reads.
const publicFiles = () => ['scenes', 'thumbs'].flatMap(d => readdirSync(`public/assets/${d}`).map(f => `assets/${d}/${f}`));
const offlineList = () => ({
  name: 'offline-list',
  configureServer(server) {
    server.middlewares.use('/offline.json', (req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ files: publicFiles() })); });
  },
  generateBundle(_, bundle) {
    const code = Object.keys(bundle).filter(f => /\.(js|css)$/.test(f));
    this.emitFile({ type: 'asset', fileName: 'offline.json', source: JSON.stringify({ files: [...code, ...publicFiles()] }) });
  },
});

// Relative URLs and unhashed file names, so `dist/` can be opened from any
// path and republished to the same artifact without leaving stale chunks behind.
export default defineConfig({
  base: './',
  plugins: [offlineList()],
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
