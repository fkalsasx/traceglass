import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = (...args) => spawnSync(process.execPath, ['bin/traceglass.mjs', ...args], { cwd: root, encoding: 'utf8' });
test('CLI produces machine-readable JSON and meaningful CI exit codes', () => {
  const result = cli('analyze', 'examples/checkout.har', '--format', 'json');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).summary.failed, 2);
  assert.equal(cli('analyze', 'examples/checkout.har', '--fail-on-errors').status, 2);
  assert.equal(cli('analyze', 'examples/checkout.har', '--max-p95', '500').status, 2);
  assert.equal(cli('analyze', 'examples/checkout.har', '--max-p95', '10000').status, 0);
  assert.equal(cli('analyze', 'examples/checkout.har', '--baseline', 'examples/checkout-before.har', '--fail-on-regression').status, 2);
});
test('CLI rejects invalid inputs, unknown flags and invalid budgets', () => {
  for (const args of [ ['analyze', 'no-such-file.har'], ['analyze', 'examples/checkout.har', '--unknown'], ['analyze', 'examples/checkout.har', '--max-p95', 'NaN'], ['analyze', 'examples/checkout.har', '--fail-on-regression'], ['analyze', 'examples/checkout.har', '--format', 'yaml'], ['sanitize', 'examples/checkout.har'] ]) {
    const result = cli(...args);
    assert.equal(result.status, 1, args.join(' '));
    assert.match(result.stderr, /Traceglass:/);
  }
});
test('CLI writes sanitized HAR, protects existing output and never overwrites source', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'traceglass-test-'));
  try {
    const output = path.join(dir, 'clean.har');
    const result = cli('sanitize', 'examples/checkout.har', '-o', output);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(!String(await readFile(output)).includes('DEMO_NOT_A_REAL_TOKEN'));
    const second = cli('sanitize', 'examples/checkout.har', '-o', output);
    assert.equal(second.status, 1);
    assert.match(second.stderr, /never overwritten/);
    const source = path.join(dir, 'source.har');
    await writeFile(source, await readFile(path.join(root, 'examples/checkout.har')));
    const snapshot = await readFile(source, 'utf8');
    assert.equal(cli('sanitize', source, '-o', source).status, 1);
    assert.equal(await readFile(source, 'utf8'), snapshot);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('CLI exports HTML/CSV, scopes queries and enforces explicit configuration budgets', async () => {
  assert.ok(cli('analyze', 'examples/checkout.har', '--format', 'html').stdout.startsWith('<!doctype html>'));
  assert.ok(cli('analyze', 'examples/checkout.har', '--format', 'csv').stdout.includes('transfer_bytes'));
  const filtered = cli('analyze', 'examples/checkout.har', '--query', 'status:5xx', '--format', 'json');
  assert.equal(JSON.parse(filtered.stdout).summary.count, 1);
  const dir = await mkdtemp(path.join(tmpdir(), 'traceglass-config-'));
  try {
    const config = path.join(dir, 'budget.json');
    await writeFile(config, JSON.stringify({ budgets: { requests: 1 } }));
    assert.equal(cli('analyze', 'examples/checkout.har', '--config', config).status, 2);
    await writeFile(config, JSON.stringify({ budgets: { requests: null, p95Ms: null, transferBytes: null, failed: null } }));
    assert.equal(cli('analyze', 'examples/checkout.har', '--config', config).status, 0);
    assert.equal(cli('analyze', 'examples/checkout.har', '--baseline-page', 'a').status, 1);
    assert.equal(cli('analyze', 'examples/checkout.har', '--page', 'missing').status, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
