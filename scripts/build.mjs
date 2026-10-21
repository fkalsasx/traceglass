import { mkdir, readdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = path.join(root, 'dist');
const fingerprint = createHash('sha256');
for (const directory of ['web', 'lib']) {
  for (const name of (await readdir(path.join(root, directory))).sort()) fingerprint.update(await readFile(path.join(root, directory, name)));
}
const revision = fingerprint.digest('hex').slice(0, 12);
const versionImports = content => content.replace(/from (['"])(\.[^'"]+\.js)\1/g, (_, quote, specifier) => `from ${quote}${specifier}?v=${revision}${quote}`);
await mkdir(target, { recursive: true });
for (const name of await readdir(path.join(root, 'web'))) {
  const source = path.join(root, 'web', name);
  if (name.endsWith('.js')) {
    // web/ is flattened into dist/. Keep shared imports inside the project subpath.
    const content = await readFile(source, 'utf8');
    const relocated = content.replaceAll("from '../lib/", "from './lib/");
    await writeFile(path.join(target, name), versionImports(relocated).replace("new URL('./worker.js',", `new URL('./worker.js?v=${revision}',`));
  } else if (name === 'index.html') {
    const content = await readFile(source, 'utf8');
    await writeFile(path.join(target, name), content.replaceAll('./app.js', `./app.js?v=${revision}`).replaceAll('./styles.css', `./styles.css?v=${revision}`));
  } else if (name.endsWith('.css')) {
    const content = await readFile(source, 'utf8');
    await writeFile(path.join(target, name), content.replaceAll('./fonts.css', `./fonts.css?v=${revision}`));
  } else await copyFile(source, path.join(target, name));
}
await mkdir(path.join(target, 'lib'), { recursive: true });
for (const name of await readdir(path.join(root, 'lib'))) {
  if (name.endsWith('.js')) await writeFile(path.join(target, 'lib', name), versionImports(await readFile(path.join(root, 'lib', name), 'utf8')));
}
console.log(`Built dist/ (${revision}) — static files only, ready for GitHub Pages or any static host.`);
