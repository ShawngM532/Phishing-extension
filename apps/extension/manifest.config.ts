import { defineManifest } from '@crxjs/vite-plugin';

import pkg from './package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: 'Sentinel',
  short_name: 'Sentinel',
  description:
    'Real-time, on-device phishing detection. Warns before you type a password into a page that is not what it claims to be.',
  version: pkg.version,
  minimum_chrome_version: '120',
  permissions: ['webNavigation', 'storage', 'tabs', 'scripting', 'offscreen'],
  host_permissions: ['<all_urls>'],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      run_at: 'document_idle',
      all_frames: true,
      js: ['src/content/index.ts'],
    },
  ],
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'Sentinel',
  },
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
  },
  web_accessible_resources: [],
});
