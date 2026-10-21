import { median } from './har.js';

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

export function compareHar(baseline, current) {
  const before = group(baseline), after = group(current);
  const endpoints = [...new Set([...before.keys(), ...after.keys()])].map(key => {
    const a = before.get(key) ?? [], b = after.get(key) ?? [];
    const previous = median(a.map(e => e.duration)), next = median(b.map(e => e.duration));
    const delta = next - previous;
    const percent = previous > 0 ? delta / previous * 100 : null;
    const state = !a.length ? 'added' : !b.length ? 'removed' : delta >= 100 && (percent === null || percent >= 20) ? 'regression' : delta <= -100 && percent <= -20 ? 'improved' : 'stable';
    return { key, previous, current: next, delta, percent, state, beforeCount: a.length, afterCount: b.length, entryIds: b.map(e => e.id) };
  });
  endpoints.sort((a, b) => b.delta - a.delta || a.key.localeCompare(b.key));
  return {
    baseline: baseline.name, current: current.name, endpoints,
    regressions: endpoints.filter(e => e.state === 'regression').length,
    improved: endpoints.filter(e => e.state === 'improved').length,
    added: endpoints.filter(e => e.state === 'added').length,
    removed: endpoints.filter(e => e.state === 'removed').length,
    durationDelta: current.summary.duration - baseline.summary.duration,
    transferDelta: current.summary.totalTransfer - baseline.summary.totalTransfer,
  };
}
