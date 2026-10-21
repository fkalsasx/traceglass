import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeHar, parseHar, safeUrl, compareHar, sanitizeHar, createReport, MAX_ENTRIES } from '../lib/index.js';
import { createDemo } from '../web/demo.js';

function capture(entries) { return { log: { version: '1.2', entries } }; }
function entry(overrides = {}) {
  return { startedDateTime: '2026-01-01T00:00:00Z', time: 100, request: { method: 'GET', url: 'https://example.com/api/items?id=1' }, response: { status: 200, bodySize: 100, headersSize: 20, content: { size: 200, mimeType: 'application/json' } }, timings: { connect: 30, ssl: 20, send: 5, wait: 55, receive: 10 }, ...overrides };
}

test('computes elapsed span across parallel, unsorted requests, not a duration sum', () => {
  const result = analyzeHar(capture([entry({ startedDateTime: '2026-01-01T00:00:00.050Z', time: 500 }), entry({ time: 1000 })]));
  assert.equal(result.summary.duration, 1000);
  assert.equal(result.entries[0].offset, 0);
  assert.equal(result.entries[1].offset, 50);
  assert.equal(result.summary.p95, 1000);
  assert.equal(result.summary.median, 750);
});

test('SSL is a subset of connect; -1 and missing timings do not inflate fallback duration', () => {
  const result = analyzeHar(capture([entry({ time: undefined, timings: { blocked: -1, dns: -1, connect: 30, ssl: 20, send: 5, wait: 55, receive: 10 } })]));
  assert.equal(result.entries[0].duration, 100);
  assert.equal(result.entries[0].phases.find(p => p.key === 'dns').value, 0);
});

test('unknown transfer stays unknown; zero byte cache hits stay zero', () => {
  const result = analyzeHar(capture([entry({ response: { status: 200, bodySize: -1, content: { size: 5000 } } }), entry({ response: { status: 304, bodySize: 0, _transferSize: 0 } })]));
  assert.equal(result.summary.totalTransfer, 0);
  assert.equal(result.summary.unknownTransfer, 1);
  assert.equal(result.entries[0].transfer, null);
  assert.equal(result.entries[1].transfer, 0);
  assert.match(result.warnings[0], /known sizes only/);
});

test('rejects malformed JSON, wrong schema, empty captures and oversized entry counts', () => {
  assert.throws(() => parseHar('{'), /valid JSON/);
  assert.throws(() => parseHar({ entries: [] }), /log.entries/);
  assert.throws(() => parseHar(capture([])), /no requests/);
  assert.throws(() => parseHar(capture(new Array(MAX_ENTRIES + 1).fill(null))), /50,000/);
  assert.equal(parseHar('\uFEFF' + JSON.stringify(createDemo())).log.entries.length, 19);
});

test('skips bad entries with warnings and rejects a wholly unreadable capture', () => {
  const result = analyzeHar(capture([null, entry({ startedDateTime: 'invalid' }), entry(), entry({ request: { url: 'data:text/html,hello' } })]));
  assert.equal(result.summary.count, 1);
  assert.match(result.warnings[0], /3 malformed/);
  assert.throws(() => analyzeHar(capture([{}])), /No readable/);
});

test('detects status 0 and 4xx/5xx but does not treat redirects as failures', () => {
  const result = analyzeHar(capture([0, 200, 301, 404, 503].map(status => entry({ response: { status } }))));
  assert.equal(result.summary.failed, 3);
  assert.equal(result.findings.find(f => f.id === 'errors').entryIds.length, 3);
});

test('query values, embedded credentials, fragments and non-HTTP URLs never enter view model URLs', () => {
  assert.equal(safeUrl('https://user:pass@example.com/path?a=secret&a=second&b=hidden#token'), 'https://example.com/path?a=REDACTED&b=REDACTED');
  assert.equal(safeUrl('javascript:alert(1)'), '[non-HTTP URL omitted]');
  assert.equal(safeUrl('broken'), '[invalid URL omitted]');
});

test('comparison ignores query values and order, uses medians, separates methods and identifies additions/removals', () => {
  const item = (url, time, method = 'GET') => entry({ time, request: { url, method } });
  const before = analyzeHar(capture([item('https://example.com/x?a=1&b=2', 100), item('https://example.com/x?b=3&a=4', 300), item('https://example.com/gone', 100)]), 'before');
  const after = analyzeHar(capture([item('https://example.com/x?b=5&a=6', 500), item('https://example.com/x?a=6&b=7', 700), item('https://example.com/x?a=7&b=8', 10_000), item('https://example.com/x?a=1&b=2', 50, 'POST')]), 'after');
  const result = compareHar(before, after);
  const match = result.endpoints.find(e => e.state === 'regression');
  assert.equal(match.previous, 200);
  assert.equal(match.current, 700);
  assert.equal(match.delta, 500);
  assert.equal(result.regressions, 1);
  assert.equal(result.added, 1);
  assert.equal(result.removed, 1);
});

test('comparison requires both absolute and relative thresholds, including a zero-duration baseline', () => {
  const a = analyzeHar(capture([entry({ time: 0 })]));
  const b = analyzeHar(capture([entry({ time: 150 })]));
  assert.equal(compareHar(a, b).regressions, 1);
  assert.equal(compareHar(analyzeHar(capture([entry({ time: 1000 })])), analyzeHar(capture([entry({ time: 1100 })]))).regressions, 0);
  assert.equal(compareHar(analyzeHar(capture([entry({ time: 10 })])), analyzeHar(capture([entry({ time: 60 })]))).regressions, 0);
});

test('sanitizer drops nested bodies, cookies, custom extensions and secrets without mutating the source', () => {
  const raw = createDemo();
  const e = raw.log.entries[0];
  e._private = 'EXTENSION_SECRET';
  e.response.content.text = 'BODY_SECRET';
  e.request.url = 'https://user:PASSWORD_SECRET@store.example.com/checkout?token=QUERY_SECRET#FRAGMENT_SECRET';
  e.request.headers.push({ name: 'X-Custom-Secret', value: 'HEADER_SECRET' });
  e.request.postData = { text: 'POST_SECRET', params: [{ name: 'x', value: 'PARAM_SECRET' }] };
  raw.log._custom = { secret: 'ROOT_SECRET' };
  e.serverIPAddress = 'IP_SECRET';
  const snapshot = JSON.stringify(raw);
  const { har, stats } = sanitizeHar(raw);
  const output = JSON.stringify(har);
  for (const token of ['EXTENSION_SECRET', 'BODY_SECRET', 'PASSWORD_SECRET', 'QUERY_SECRET', 'FRAGMENT_SECRET', 'HEADER_SECRET', 'POST_SECRET', 'PARAM_SECRET', 'ROOT_SECRET', 'IP_SECRET', 'DEMO_NOT_A_REAL_TOKEN', 'synthetic-session']) assert.ok(!output.includes(token), token);
  assert.equal(JSON.stringify(raw), snapshot);
  assert.equal(har.log.entries[0].request.headers.at(-1).value, '[REDACTED]');
  assert.equal(har.log.entries[0].response.content.mimeType, 'text/html');
  assert.equal(analyzeHar(har).summary.count, 19);
  assert.ok(stats.redactedHeaders > 0);
  assert.deepEqual(sanitizeHar(har).har, har, 'sanitizing twice is stable');
});

test('reports escape active Markdown and table injection from hostile metadata', () => {
  const malicious = analyzeHar(capture([entry({ request: { url: 'https://example.com/a|b?[x]=secret', method: 'GET' } })]), '[x](https://evil.example)\n![tracking](https://evil.example/pixel)');
  const report = createReport(malicious);
  assert.ok(!report.includes('![tracking]'));
  assert.ok(!report.includes('[x](https://evil'));
  assert.ok(!report.includes('=secret'));
  assert.ok(report.includes('\\|'));
});

test('demo tells a reproducible before/after story', () => {
  const current = analyzeHar(createDemo());
  const before = analyzeHar(createDemo(true));
  assert.equal(current.summary.count, 19);
  assert.equal(current.summary.failed, 2);
  assert.equal(current.summary.slow, 3);
  assert.equal(compareHar(before, current).regressions, 3);
  assert.equal(current.findings.length, 4);
});

test('SVG is an image, malformed header records do not break analysis or export', () => {
  const raw = entry();
  raw.response.content.mimeType = 'image/svg+xml';
  raw.response.headers = [null, { name: 123, value: 'broken' }, { name: 'Cache-Control', value: 'max-age=600' }];
  const result = analyzeHar(capture([raw]));
  assert.equal(result.entries[0].type, 'image');
  assert.equal(result.entries[0].cacheControl, 'max-age=600');
  assert.equal(sanitizeHar(capture([raw])).har.log.entries[0].response.headers.length, 1);
});
