import { parseHar, safeUrl } from './har.js';

const REDACTED = '[REDACTED]';
const SAFE_HEADERS = new Set(['content-type', 'content-length', 'content-encoding', 'cache-control', 'accept', 'accept-encoding']);
const number = (n, fallback = -1) => Number.isFinite(n) ? n : fallback;
const mime = value => typeof value === 'string' ? value.split(';')[0].slice(0, 120) : '';

function headers(input) {
  return (Array.isArray(input) ? input : []).filter(h => typeof h?.name === 'string').map(h => ({
    name: h.name, value: SAFE_HEADERS.has(h.name.toLowerCase()) ? String(h.value ?? '') : REDACTED,
  }));
}

/** Rebuild a HAR from known fields, discarding bodies, cookies, IPs, comments and extensions. */
export function sanitizeHar(input) {
  const doc = parseHar(input);
  let redactedHeaders = 0, queryValues = 0, bodies = 0;
  const entries = doc.log.entries.filter(e => e?.request && e?.response).map(e => {
    const req = e.request, res = e.response;
    for (const h of [...(Array.isArray(req.headers) ? req.headers : []), ...(Array.isArray(res.headers) ? res.headers : [])]) {
      if (typeof h?.name === 'string' && !SAFE_HEADERS.has(h.name.toLowerCase())) redactedHeaders++;
    }
    try { queryValues += [...new URL(req.url).searchParams].length; } catch { /* invalid URL is replaced */ }
    if (req.postData || res.content?.text !== undefined) bodies++;
    const url = safeUrl(req.url);
    let queryString = [];
    try { queryString = [...new URL(url).searchParams].map(([name, value]) => ({ name, value })); } catch { /* no URL */ }
    const entry = {
      startedDateTime: Number.isFinite(Date.parse(e.startedDateTime)) ? new Date(e.startedDateTime).toISOString() : '1970-01-01T00:00:00.000Z',
      time: number(e.time, 0),
      request: { method: String(req.method ?? 'GET'), url, httpVersion: String(req.httpVersion ?? ''), cookies: [], headers: headers(req.headers), queryString, headersSize: number(req.headersSize), bodySize: number(req.bodySize) },
      response: { status: number(res.status, 0), statusText: '', httpVersion: String(res.httpVersion ?? ''), cookies: [], headers: headers(res.headers), content: { size: number(res.content?.size, 0), mimeType: mime(res.content?.mimeType) }, redirectURL: res.redirectURL ? safeUrl(res.redirectURL) : '', headersSize: number(res.headersSize), bodySize: number(res.bodySize) },
      cache: {}, timings: Object.fromEntries(['blocked', 'dns', 'connect', 'send', 'wait', 'receive', 'ssl'].map(key => [key, ['send', 'wait', 'receive'].includes(key) ? Math.max(0, number(e.timings?.[key], 0)) : number(e.timings?.[key])])),
    };
    if (Number.isFinite(res._transferSize)) entry.response._transferSize = res._transferSize;
    return entry;
  });
  return { har: { log: { version: '1.2', creator: { name: 'Traceglass (sanitized)', version: '1.0.0' }, entries } }, stats: { redactedHeaders, queryValues, bodies } };
}
