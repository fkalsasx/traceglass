/** HAR analysis shared by the browser worker and the CLI. No network or DOM access. */
export const MAX_BYTES = 50 * 1024 * 1024;
export const MAX_ENTRIES = 50_000;
const positive = (value, fallback = 0) => Number.isFinite(value) && value >= 0 ? value : fallback;
export const median = values => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export function parseHar(input) {
  let doc = input;
  if (typeof input === 'string') {
    if (new TextEncoder().encode(input).byteLength > MAX_BYTES) throw new Error('HAR exceeds the 50 MiB limit. Export a shorter capture.');
    try { doc = JSON.parse(input.replace(/^\uFEFF/, '')); }
    catch { throw new Error('This file is not valid JSON. Export a HAR from your browser’s Network panel.'); }
  }
  if (!doc || !Array.isArray(doc.log?.entries)) throw new Error('Expected a HAR object with a log.entries array.');
  if (doc.log.entries.length > MAX_ENTRIES) throw new Error('HAR exceeds 50,000 requests. Export a shorter capture.');
  if (!doc.log.entries.length) throw new Error('This HAR has no requests. Record some network activity first.');
  return doc;
}

export function safeUrl(input) {
  try {
    const url = new URL(input);
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) return '[non-HTTP URL omitted]';
    url.username = '';
    url.password = '';
    url.hash = '';
    for (const key of [...new Set(url.searchParams.keys())]) url.searchParams.set(key, 'REDACTED');
    return url.href;
  } catch { return '[invalid URL omitted]'; }
}

export function resourceType(mime = '', url = '') {
  const type = mime.toLowerCase().split(';')[0];
  if (/html/.test(type)) return 'document';
  if (/javascript|ecmascript/.test(type)) return 'script';
  if (/css/.test(type)) return 'stylesheet';
  if (type.startsWith('image/')) return 'image';
  if (/font|woff/.test(type)) return 'font';
  if (/audio|video/.test(type)) return 'media';
  if (/json|xml|graphql/.test(type)) return 'fetch';
  if (/\/api\//.test(url)) return 'fetch';
  return 'other';
}

function headerValue(headers, name) {
  return Array.isArray(headers) ? headers.find(h => typeof h?.name === 'string' && h.name.toLowerCase() === name)?.value ?? '' : '';
}

export function analyzeHar(input, name = 'capture.har') {
  const doc = parseHar(input);
  const warnings = [];
  const entries = [];
  let invalid = 0;
  for (const [index, raw] of doc.log.entries.entries()) {
    const start = Date.parse(raw?.startedDateTime);
    if (!raw?.request || !raw?.response || typeof raw.request.url !== 'string' || !Number.isFinite(start)) { invalid++; continue; }
    const url = safeUrl(raw.request.url);
    let parsed;
    try { parsed = new URL(url); } catch { invalid++; continue; }
    const timings = raw.timings ?? {};
    // SSL is already included in connect in HAR 1.2. Do not count it twice.
    const phases = ['blocked', 'dns', 'connect', 'send', 'wait', 'receive'].map(key => ({ key, value: positive(timings[key]) }));
    const duration = positive(raw.time, phases.reduce((sum, p) => sum + p.value, 0));
    const transfer = positive(raw.response._transferSize, null) ??
      (positive(raw.response.bodySize, null) !== null ? raw.response.bodySize + positive(raw.response.headersSize) : null);
    const mime = typeof raw.response.content?.mimeType === 'string' ? raw.response.content.mimeType : '';
    const method = typeof raw.request.method === 'string' ? raw.request.method.toUpperCase() : 'GET';
    const status = positive(raw.response.status);
    entries.push({
      id: index, url, host: parsed.host, path: parsed.pathname + parsed.search,
      method, status, start, duration, transfer, decoded: positive(raw.response.content?.size, null),
      mime, type: resourceType(mime, url), phases, ssl: positive(timings.ssl),
      wait: positive(timings.wait, null), cacheControl: String(headerValue(raw.response.headers, 'cache-control')),
      protocol: String(raw.response.httpVersion ?? ''), page: String(raw.pageref ?? ''),
      failed: status === 0 || status >= 400,
      // Keep only redacted metadata in the view model; raw bodies never enter the UI.
    });
  }
  if (!entries.length) throw new Error('No readable requests. Entries need request, response and a valid startedDateTime.');
  entries.sort((a, b) => a.start - b.start || a.id - b.id);
  const start = entries[0].start;
  for (const entry of entries) entry.offset = entry.start - start;
  const duration = entries.reduce((max, e) => Math.max(max, e.offset + e.duration), 0);
  const durations = entries.map(e => e.duration).sort((a, b) => a - b);
  const totalTransfer = entries.reduce((sum, e) => sum + (e.transfer ?? 0), 0);
  const unknownTransfer = entries.filter(e => e.transfer === null).length;
  if (invalid) warnings.push(`${invalid} malformed or non-HTTP request${invalid === 1 ? '' : 's'} skipped.`);
  if (unknownTransfer) warnings.push(`Transfer size unavailable for ${unknownTransfer} request${unknownTransfer === 1 ? '' : 's'}; totals include known sizes only.`);
  const failures = entries.filter(e => e.failed);
  const slow = entries.filter(e => e.wait !== null && e.wait >= 600 && e.wait / Math.max(e.duration, 1) >= .6);
  const large = entries.filter(e => e.transfer !== null && e.transfer >= 500_000);
  const uncached = entries.filter(e => e.method === 'GET' && e.status === 200 && ['script', 'stylesheet', 'font', 'image'].includes(e.type) && !e.cacheControl);
  const findings = [];
  if (failures.length) findings.push({ id: 'errors', severity: 'error', title: `${failures.length} failed request${failures.length === 1 ? '' : 's'}`, detail: 'Inspect HTTP errors and requests with status 0. A status of 0 may indicate a cancelled, blocked or failed request.', entryIds: failures.map(e => e.id) });
  if (slow.length) findings.push({ id: 'waiting', severity: 'warning', title: `${slow.length} long server wait${slow.length === 1 ? '' : 's'}`, detail: 'At least 600 ms and 60% of the request spent waiting for the first byte. Check backend traces, cache misses and network latency.', entryIds: slow.map(e => e.id) });
  if (large.length) findings.push({ id: 'large', severity: 'warning', title: `${large.length} large transfer${large.length === 1 ? '' : 's'}`, detail: 'At least 500 kB transferred per request. Check compression, code splitting and image dimensions.', entryIds: large.map(e => e.id) });
  if (uncached.length) findings.push({ id: 'cache', severity: 'info', title: `${uncached.length} static asset${uncached.length === 1 ? '' : 's'} without Cache-Control`, detail: 'No Cache-Control response header was captured. Verify caching policy; HAR metadata alone cannot determine browser cache behavior.', entryIds: uncached.map(e => e.id) });
  const domains = [...new Set(entries.map(e => e.host))];
  return { name, entries, findings, warnings, summary: {
    count: entries.length, failed: failures.length, duration, totalTransfer, unknownTransfer,
    median: median(durations), p95: durations[Math.ceil(durations.length * .95) - 1],
    domains: domains.length, start, slow: slow.length,
  } };
}

export function formatDuration(ms) { return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`; }
export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return 'unknown';
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`;
  if (bytes >= 1000) return `${(bytes / 1000).toFixed(1)} kB`;
  return `${bytes} B`;
}
