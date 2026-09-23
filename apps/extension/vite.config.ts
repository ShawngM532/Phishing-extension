import { crx } from '@crxjs/vite-plugin';
import { defineConfig } from 'vite';

import manifest from './manifest.config.ts';

export default defineConfig(({ mode }) => ({
  plugins: [crx({ manifest })],
  define: {
    __SENTINEL_E2E__: JSON.stringify(mode === 'e2e'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'chrome120',
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
}));
