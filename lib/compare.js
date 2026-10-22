import { median } from './har.js';
import { normalizeConfig } from './config.js';

/** Aggregate repeated endpoints; ignore query values, preserve query names and HTTP method. */
export function endpointKey(entry) {
  const url = new URL(entry.url);
  const names = [...new Set(url.searchParams.keys())].sort();
  return `${entry.method} ${url.origin}${url.pathname}${names.length ? '?' + names.map(encodeURIComponent).join('&') : ''}`;
}

function group(analysis) {
  const groups = new Map();
  for (const entry of analysis.entries) {
    const key = endpointKey(entry);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  return groups;
}

export function compareHar(baseline, current, options = {}) {
  const config = normalizeConfig(options.config ?? current.config);
  const before = group(baseline), after = group(current);
  const endpoints = [...new Set([...before.keys(), ...after.keys()])].map(key => {
    const a = before.get(key) ?? [], b = after.get(key) ?? [];
    const previous = median(a.map(e => e.duration)), next = median(b.map(e => e.duration));
    const delta = next - previous;
    const percent = previous > 0 ? delta / previous * 100 : null;
    const state = !a.length ? 'added' : !b.length ? 'removed' : delta > 0 && delta >= config.regressionMs && (percent === null || percent >= config.regressionPercent) ? 'regression' : delta < 0 && delta <= -config.regressionMs && percent <= -config.regressionPercent ? 'improved' : 'stable';
    const beforeFailed = a.filter(e => e.failed).length, afterFailed = b.filter(e => e.failed).length;
    return { key, previous, current: next, delta, percent, state, beforeCount: a.length, afterCount: b.length, beforeFailed, afterFailed,
      newFailure: a.length > 0 && beforeFailed === 0 && afterFailed > 0,
      beforeTransfer: a.reduce((sum, e) => sum + (e.transfer ?? 0), 0), afterTransfer: b.reduce((sum, e) => sum + (e.transfer ?? 0), 0),
      entryIds: b.map(e => e.id) };
  });
  endpoints.sort((a, b) => b.delta - a.delta || a.key.localeCompare(b.key));
  return {
    baseline: baseline.name, current: current.name, endpoints, config,
    newFailures: endpoints.filter(e => e.newFailure).length,
    regressions: endpoints.filter(e => e.state === 'regression').length,
    improved: endpoints.filter(e => e.state === 'improved').length,
    added: endpoints.filter(e => e.state === 'added').length,
    removed: endpoints.filter(e => e.state === 'removed').length,
    durationDelta: current.summary.duration - baseline.summary.duration,
    transferDelta: current.summary.totalTransfer - baseline.summary.totalTransfer,
  };
}
