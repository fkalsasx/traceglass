import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { startServer } from '../scripts/serve.mjs';

test('local server serves the app and modules while keeping repository files private', async () => {
  const server = startServer(0);
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const url of ['/', '/app.js', '/worker.js', '/lib/index.js']) {
      const result = await fetch(base + url);
      assert.equal(result.status, 200, url);
      assert.equal(result.headers.get('x-content-type-options'), 'nosniff');
    }
    for (const url of ['/.git/config', '/package.json', '/examples/checkout.har', '/lib/%2e%2e%2fpackage.json', '/%00', '/lib/har.js%00']) assert.equal((await fetch(base + url)).status, 404, url);
    assert.equal((await fetch(base, { method: 'POST', body: 'secret' })).status, 405);
    assert.equal((await fetch(base, { method: 'HEAD' })).status, 200);
    const font = await fetch(base + '/manrope-variable.ttf');
    assert.equal(font.status, 200);
    assert.equal(font.headers.get('content-type'), 'font/ttf');
    assert.ok((await font.arrayBuffer()).byteLength > 1000);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
