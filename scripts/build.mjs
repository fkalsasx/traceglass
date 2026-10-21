import { mkdir, readdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = path.join(root, 'dist');
await mkdir(target, { recursive: true });
for (const name of await readdir(path.join(root, 'web'))) {
  const source = path.join(root, 'web', name);
  if (name.endsWith('.js')) {
    // web/ is flattened into dist/. Keep shared imports inside the project subpath.
    const content = await readFile(source, 'utf8');
    await writeFile(path.join(target, name), content.replaceAll("from '../lib/", "from './lib/"));
  } else await copyFile(source, path.join(target, name));
}
await mkdir(path.join(target, 'lib'), { recursive: true });
for (const name of await readdir(path.join(root, 'lib'))) {
  if (name.endsWith('.js')) await copyFile(path.join(root, 'lib', name), path.join(target, 'lib', name));
}
console.log('Built dist/ — static files only, ready for GitHub Pages or any static host.');
