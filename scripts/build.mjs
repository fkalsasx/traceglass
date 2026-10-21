import { mkdir, readdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = path.join(root, 'dist');
await mkdir(target, { recursive: true });
for (const name of await readdir(path.join(root, 'web'))) {
  await copyFile(path.join(root, 'web', name), path.join(target, name));
}
await mkdir(path.join(target, 'lib'), { recursive: true });
for (const name of await readdir(path.join(root, 'lib'))) {
  if (name.endsWith('.js')) await copyFile(path.join(root, 'lib', name), path.join(target, 'lib', name));
}
console.log('Built dist/ — static files only, ready for GitHub Pages or any static host.');
