import { crx } from '@crxjs/vite-plugin';
import { readFile, writeFile } from 'node:fs/promises';
import { defineConfig, type Plugin } from 'vite';

import manifest from './manifest.config.ts';

interface WebAccessibleResource {
  matches: string[];
  resources: string[];
  use_dynamic_url?: boolean;
}

interface BuiltManifest {
  web_accessible_resources?: WebAccessibleResource[];
}

/**
 * crxjs exposes the content-script loader chunks as web-accessible resources
 * so it can `import()` them from every page. We cannot remove them, and
 * `use_dynamic_url: true` breaks crxjs's loader (it resolves the static path,
 * which Chrome then denies), so the residual fingerprinting risk is accepted
 * and recorded in ADR #7. This plugin only drops the `.map` resources, which
 * the loader never needs.
 */
function hardenWebAccessibleResources(): Plugin {
  return {
    name: 'sentinel-harden-web-accessible-resources',
    apply: 'build',
    async closeBundle() {
      const manifestUrl = new URL('./dist/manifest.json', import.meta.url);
      const built = JSON.parse(await readFile(manifestUrl, 'utf8')) as BuiltManifest;
      if (!Array.isArray(built.web_accessible_resources)) return;
      for (const entry of built.web_accessible_resources) {
        entry.resources = entry.resources.filter((resource) => !resource.endsWith('.map'));
      }
      await writeFile(manifestUrl, `${JSON.stringify(built, null, 2)}\n`);
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [crx({ manifest }), hardenWebAccessibleResources()],
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
