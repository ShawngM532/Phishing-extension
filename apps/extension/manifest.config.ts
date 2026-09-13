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
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      run_at: 'document_idle',
      all_frames: true,
      js: ['src/content/content-script.ts'],
    },
  ],
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'Sentinel',
    default_icon: {
      16: 'icons/green-16.png',
      32: 'icons/green-32.png',
      48: 'icons/green-48.png',
      128: 'icons/green-128.png',
    },
  },
  icons: {
    16: 'icons/green-16.png',
    32: 'icons/green-32.png',
    48: 'icons/green-48.png',
    128: 'icons/green-128.png',
  },
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
  },
  web_accessible_resources: [],
});
