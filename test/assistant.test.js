import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeHar, answerQuestion, compareHar } from '../lib/index.js';
import { createDemo } from '../web/demo.js';

const analysis = analyzeHar(createDemo(), 'checkout.har');
const ask = (question, extra = {}) => answerQuestion({ question, analysis, ...extra });

test('local analyst uses captured evidence and preserves Turkish intent', () => {
  const summary = ask('Önce neyi düzeltmeliyim?');
  assert.equal(summary.topic, 'summary');
  assert.match(summary.lead, /19 istek · 2 başarısız/);
  for (const e of summary.evidence) assert.ok(analysis.entries.some(r => r.id === e.entryId));
  const slow = ask('NEDEN YAVAŞ?');
  assert.equal(slow.topic, 'slow');
  assert.match(slow.lead, /2\.14 s/);
  assert.equal(slow.evidence.length, 3);
  assert.match(slow.note, /tek başına/);
  assert.equal(ask('Büyük dosyaları bul').evidence[0].entryId, 10);
  assert.equal(ask('Önbelleği incele').topic, 'cache');
  assert.equal(ask('Bütçeler nasıl?').topic, 'budgets');
});

test('status explanations distinguish captured errors from general definitions', () => {
  const grouped = ask('Hataları açıkla');
  assert.ok(grouped.sections.some(s => s.title.startsWith('503')));
  assert.ok(grouped.sections.some(s => s.title.startsWith('404')));
  const answer = ask('503 ne demek?');
  assert.equal(answer.evidence.length, 1);
  assert.match(answer.evidence[0].detail, /^503/);
  assert.match(answer.note, /kanıtlamaz/);
  const missing = ask('429 hatası nedir?');
  assert.equal(missing.evidence.length, 0);
  assert.match(missing.lead, /0 istek/);
  assert.match(missing.sections.flatMap(s => s.items).join(' '), /genel durum kodu/);
  assert.match(ask('status 0').note, /CORS.*kanıtlamaz/);
});

test('request paths and follow-ups keep a bounded, validated focus', () => {
  const focused = ask('/api/cart neden yavaş?');
  assert.equal(focused.evidence.length, 1);
  assert.match(focused.evidence[0].label, /\/api\/cart$/);
  const follow = ask('Nasıl düzeltirim?', { context: focused.context });
  assert.equal(follow.topic, 'request');
  assert.equal(follow.evidence[0].entryId, focused.evidence[0].entryId);
  assert.equal(ask('neden', { context: { topic: 'made-up', entryId: -1 } }).topic, 'unsupported');
  assert.match(ask('/assets/vendor.js').title, /vendor\.js/);
});

test('scopes and threshold changes affect the answer without stale references', () => {
  const doc = createDemo();
  doc.log.entries.forEach((e, i) => { e.pageref = i === 7 ? 'error' : 'rest'; });
  const scoped = analyzeHar(doc, 'scoped.har', { pageId: 'error', config: { slowWaitMs: 99999, largeTransferBytes: 9999999 } });
  const answer = answerQuestion({ question: 'Özet', analysis: scoped });
  assert.match(answer.lead, /^1 istek · 1 başarısız/);
  assert.equal(answer.evidence.length, 1);
  assert.equal(answer.evidence[0].entryId, 7);
  assert.match(answer.sections.flatMap(s => s.items).join(' '), /Hiçbir istek/);
  assert.match(answer.sections.flatMap(s => s.items).join(' '), /büyük aktarım eşiğini aşan istek yok/);
});

test('comparison explains endpoint medians only when a baseline exists', () => {
  assert.equal(ask('Ne değişti?').evidence.length, 0);
  const comparison = compareHar(analyzeHar(createDemo(true)), analysis);
  const answer = ask('Önceki kayıtla ne değişti?', { comparison });
  assert.match(answer.title, /3 gerileme, 2 yeni hata/);
  assert.ok(answer.evidence.length > 0);
  assert.match(answer.sections[0].items.join(' '), /480 ms → 2\.14 s/);
});

test('missing sizes are not converted into a fabricated size estimate', () => {
  const doc = createDemo();
  for (const e of doc.log.entries) { delete e.response._transferSize; e.response.bodySize = -1; e.response.headersSize = -1; }
  const unknown = analyzeHar(doc);
  const answer = answerQuestion({ question: 'Büyük dosyalar', analysis: unknown });
  assert.match(answer.lead, /alt sınır/);
  assert.equal(answer.evidence.length, 0);
  assert.match(answer.sections[0].items.join(' '), /sıralaması yapılamıyor/);
});

test('local analyst is honest about its limits and rejects invalid input', () => {
  assert.throws(() => ask('   '), /Bir soru/);
  assert.throws(() => ask('a'.repeat(2001)), /2.000/);
  assert.match(ask('Yapay zeka modeli mi?').lead, /kural tabanlı/);
  assert.match(answerQuestion({ question: 'Neden yavaş?' }).lead, /ölçüm ya da sorun uydurmam/);
  assert.equal(ask('<img src=x onerror=alert(1)> bana şiir yaz').topic, 'unsupported');
});
