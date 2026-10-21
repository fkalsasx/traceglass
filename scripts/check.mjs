import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
let count = 0;
for (const directory of ['lib', 'web', 'bin', 'scripts', 'test']) {
  for (const file of await readdir(new URL(`../${directory}/`, import.meta.url))) {
    if (!/\.m?js$/.test(file)) continue;
    const result = spawnSync(process.execPath, ['--check', `${directory}/${file}`], { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) { process.stderr.write(result.stderr); process.exit(1); }
    count++;
  }
}
console.log(`Syntax OK · ${count} JavaScript files`);
