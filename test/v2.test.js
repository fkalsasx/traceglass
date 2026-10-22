import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeHar, compareHar, compileQuery, normalizeConfig, createHtmlReport, createCsv } from '../lib/index.js';
import { createDemo } from '../web/demo.js';

test('overview computes exact half-open concurrency and idle gaps for parallel requests', () => {
  const doc = createDemo();
  const base = doc.log.entries[0];
  doc.log.entries = [[0, 100], [50, 50], [100, 100], [300, 50], [400, 0]].map(([offset, time]) => ({ ...base, startedDateTime: new Date(Date.parse(base.startedDateTime) + offset).toISOString(), time }));
  const model = analyzeHar(doc);
  assert.equal(model.overview.peakConcurrency, 2, 'ending requests do not overlap requests starting at the same instant');
  assert.equal(model.overview.busyMs, 250);
  assert.equal(model.overview.idleMs, 150);
  assert.equal(model.overview.concurrency.length, 100);
  assert.equal(model.overview.domains[0].count, 5);
});

test('page selection keeps original entry IDs but resets timeline and every aggregate', () => {
  const doc = createDemo();
  doc.log.entries.forEach((e, i) => { e.pageref = i < 5 ? 'first' : 'second'; });
  const scoped = analyzeHar(doc, 'pages.har', { pageId: 'second' });
  assert.equal(scoped.summary.count, 14);
  assert.equal(scoped.entries[0].id, 5);
  assert.equal(scoped.entries[0].offset, 0);
  assert.equal(scoped.pages.length, 2);
  assert.equal(scoped.pages[0].count, 5);
  assert.equal(scoped.overview.domains.reduce((sum, d) => sum + d.count, 0), 14);
  assert.throws(() => analyzeHar(doc, 'pages.har', { pageId: 'missing' }), /No requests match/);
});

test('threshold changes alter findings and comparison; new failures are visible independently of duration', () => {
  const current = analyzeHar(createDemo(), 'after', { config: { slowWaitMs: 3000, largeTransferBytes: 2_000_000, regressionMs: 5000 } });
  assert.ok(!current.findings.some(f => ['waiting', 'large'].includes(f.id)));
  const comparison = compareHar(analyzeHar(createDemo(true)), current);
  assert.equal(comparison.regressions, 0);
  assert.equal(comparison.newFailures, 2);
  assert.ok(comparison.endpoints.find(e => e.key.includes('recommendations')).newFailure);
});

test('unknown transfer cannot receive a passing budget, while a proven overage fails', () => {
  const doc = createDemo();
  delete doc.log.entries[0].response._transferSize;
  doc.log.entries[0].response.bodySize = -1;
  const result = analyzeHar(doc, 'unknown', { config: { budgets: { transferBytes: 10_000_000 } } });
  assert.equal(result.budgets.find(b => b.key === 'transferBytes').status, 'unknown');
  assert.equal(analyzeHar(doc, 'over', { config: { budgets: { transferBytes: 1 } } }).budgets.find(b => b.key === 'transferBytes').status, 'fail');
  assert.equal(analyzeHar(doc, 'disabled', { config: { budgets: { transferBytes: null } } }).budgets.length, 3);
});

test('configuration rejects typos, invalid limits and prototype keys without mutating defaults', () => {
  const snapshot = normalizeConfig();
  for (const config of [{ slowWaitRatio: 2 }, { budgets: { failed: .5 } }, { budgets: null }, { typo: 4 }, { regressionMs: Infinity }, JSON.parse('{"__proto__":{"polluted":true}}'), JSON.parse('{"budgets":{"constructor":1}}')]) assert.throws(() => normalizeConfig(config));
  const next = normalizeConfig({ budgets: { failed: null }, slowWaitMs: 0 });
  assert.equal(next.budgets.failed, null);
  assert.deepEqual(normalizeConfig(), snapshot);
  assert.equal({}.polluted, undefined);
});

test('advanced search composes fields, units, quoted phrases, negation and literal URLs', () => {
  const rows = analyzeHar(createDemo()).entries;
  assert.equal(rows.filter(compileQuery('status:5xx time:>1s -domain:analytics')).length, 1);
  assert.equal(rows.filter(compileQuery('type:image size:>500kb')).length, 1);
  assert.equal(rows.filter(compileQuery('method:POST is:success')).length, 2);
  assert.equal(rows.filter(compileQuery('"store.example.com/api/cart"')).length, 1);
  assert.equal(rows.filter(compileQuery('https://store.example.com/api/cart')).length, 1);
  assert.equal(analyzeHar(createDemo(), 'filtered', { query: 'is:failed' }).summary.count, 2);
  const unknown = { ...rows[0], transfer: null };
  assert.equal(compileQuery('size:<1mb')(unknown), false);
  for (const query of ['time:hello', 'status:>500ms', 'size:>2s', 'domain:', '"unfinished', 'is:cached']) assert.throws(() => compileQuery(query), query);
});

test('HTML is a passive standalone document and escapes hostile capture content', () => {
  const doc = createDemo();
  doc.log.entries[0].request.method = '<img src="https://evil.example" onerror=alert(1)>';
  doc.log.entries[0].time = 10_000;
  const model = analyzeHar(doc, '</title><script>alert(1)</script>');
  const html = createHtmlReport(model, compareHar(analyzeHar(createDemo(true)), model));
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes("default-src 'none'"));
  assert.ok(html.includes('Content-Security-Policy'));
  assert.ok(!/<script\b|<img\b|<iframe\b|<link\b/i.test(html));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('DEMO_NOT_A_REAL_TOKEN'));
  assert.ok(!html.includes('synthetic-session'));
  assert.ok(html.includes('<svg'));
});

test('CSV escapes quotes, multiline fields and spreadsheet formulas, preserving numeric columns', () => {
  const model = analyzeHar(createDemo());
  model.entries[0].page = ' =HYPERLINK("https://evil.example")';
  model.entries[0].method = 'GET\r\n"quoted"';
  const csv = createCsv(model);
  assert.ok(csv.startsWith('\uFEFF"method"'));
  assert.ok(csv.includes('"\' =HYPERLINK(""https://evil.example"")"'));
  assert.ok(csv.includes('"GET\r\n""quoted"""'));
  assert.ok(!csv.includes('DEMO_NOT_A_REAL_TOKEN'));
  assert.ok(csv.includes('"184"'));
});
