import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
test('built module imports stay inside a GitHub Pages project subpath and resolve to real files', async () => {
  const result = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const prefix = 'https://example.test/project/';
  const dist = path.join(root, 'dist');
  for (const file of await readdir(dist, { recursive: true })) {
    if (!file.endsWith('.js')) continue;
    const content = await readFile(path.join(dist, file), 'utf8');
    const source = new URL(file.replaceAll('\\', '/'), prefix);
    for (const match of content.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const dependency = new URL(match[1], source);
      assert.ok(dependency.href.startsWith(prefix), `${file}: ${match[1]} escapes the deployment subpath`);
      await assert.doesNotReject(access(path.join(dist, decodeURIComponent(dependency.pathname.slice(new URL(prefix).pathname.length)))));
      assert.match(dependency.search, /^\?v=[a-f\d]{12}$/, 'all modules share a build fingerprint to avoid mixing cached versions');
    }
  }
});
