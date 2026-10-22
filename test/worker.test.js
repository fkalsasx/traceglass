import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { createDemo } from '../web/demo.js';

test('browser worker supports scoped exports, atomic invalid imports and live configuration', async () => {
  const source = `import {parentPort} from 'node:worker_threads'; globalThis.self={postMessage:value=>parentPort.postMessage(value)}; await import(${JSON.stringify(new URL('../web/worker.js', import.meta.url).href)}); parentPort.on('message',data=>self.onmessage({data}));`;
  const worker = new Worker(new URL('data:text/javascript,' + encodeURIComponent(source)));
  const pending = new Map();
  let id = 0;
  worker.on('message', message => {
    const task = pending.get(message.id);
    if (!task) return;
    clearTimeout(task.timer); pending.delete(message.id);
    message.error ? task.reject(new Error(message.error)) : task.resolve(message.result);
  });
  worker.on('error', error => { for (const task of pending.values()) { clearTimeout(task.timer); task.reject(error); } pending.clear(); });
  function send(type, data = {}) {
    return new Promise((resolve, reject) => {
      const requestId = ++id;
      const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('Worker response timed out')); }, 5000);
      pending.set(requestId, { resolve, reject, timer });
      worker.postMessage({ id: requestId, type, ...data });
    });
  }
  try {
    const doc = createDemo();
    doc.log.entries.forEach((e, i) => { e.pageref = i < 5 ? 'first' : 'second'; });
    assert.equal((await send('load', { text: JSON.stringify(doc), name: 'pages.har' })).analysis.summary.count, 19);
    await send('baseline', { demo: true, name: 'before.har' });
    const scoped = await send('scope', { pageId: 'first' });
    assert.equal(scoped.analysis.summary.count, 5);
    assert.equal(JSON.parse((await send('sanitize')).text).log.entries.length, 5);
    await assert.rejects(send('load', { text: '{', name: 'broken' }), /valid JSON/);
    await assert.rejects(send('scope', { pageId: 'missing' }), /No requests match/);
    const restored = await send('config', { config: { budgets: { requests: 3 } } });
    assert.equal(restored.analysis.name, 'pages.har');
    assert.equal(restored.analysis.summary.count, 5);
    assert.equal(restored.analysis.budgets.find(b => b.key === 'requests').status, 'fail');
    assert.ok((await send('html')).text.includes('<!doctype html>'));
    assert.ok((await send('csv')).text.includes('transfer_bytes'));
    assert.ok((await send('report')).text.includes('Performance budgets'));
    assert.equal((await send('clear-baseline')).comparison, null);
  } finally { await worker.terminate(); }
});
