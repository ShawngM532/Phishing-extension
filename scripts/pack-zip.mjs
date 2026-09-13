import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'apps', 'extension', 'dist');
const outDir = join(root, 'artifacts');

if (!existsSync(distDir)) {
  console.error(`[pack:zip] dist not found at ${distDir}. Run "pnpm build" first.`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const extPkg = JSON.parse(readFileSync(join(root, 'apps', 'extension', 'package.json'), 'utf8'));
const version = extPkg.version === '0.0.0' ? pkg.version : extPkg.version;
const zipName = `sentinel-${version}.zip`;
const zipPath = join(outDir, zipName);

mkdirSync(outDir, { recursive: true });
if (existsSync(zipPath)) rmSync(zipPath, { force: true });

if (process.platform === 'win32') {
  const shell = process.env.PWSH ?? 'pwsh';
  execFileSync(
    shell,
    [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path '${join(distDir, '*')}' -DestinationPath '${zipPath}' -Force`,
    ],
    { stdio: 'inherit' },
  );
} else {
  execFileSync('zip', ['-r', '-q', zipPath, '.'], { cwd: distDir, stdio: 'inherit' });
}

console.log(`[pack:zip] wrote ${zipPath}`);
