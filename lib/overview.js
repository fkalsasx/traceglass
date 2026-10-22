import { median } from './stats.js';

function breakdown(entries, key) {
  const groups = new Map();
  for (const entry of entries) {
    const name = key(entry);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(entry);
  }
  return [...groups].map(([name, rows]) => ({
    name, count: rows.length, failed: rows.filter(e => e.failed).length,
    transfer: rows.reduce((sum, e) => sum + (e.transfer ?? 0), 0),
    unknownTransfer: rows.filter(e => e.transfer === null).length,
    median: median(rows.map(e => e.duration)),
    wait: rows.reduce((sum, e) => sum + (e.wait ?? 0), 0),
  })).sort((a, b) => b.transfer - a.transfer || b.count - a.count || a.name.localeCompare(b.name));
}

/** Exact peak/union, with at most 100 time bins for a bounded browser chart. */
export function createOverview(entries, span) {
  const events = [];
  for (const e of entries) if (e.duration > 0) events.push([e.offset, 1], [e.offset + e.duration, -1]);
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let active = 0, peak = 0, busy = 0, previous = 0;
  const segments = [];
  for (const [time, delta] of events) {
    if (time > previous) {
      segments.push({ start: previous, end: time, active });
      if (active > 0) busy += time - previous;
    }
    active += delta;
    peak = Math.max(peak, active);
    previous = time;
  }
  const width = Math.max(span, 1) / 100;
  const concurrency = Array.from({ length: 100 }, (_, i) => ({ start: i * width, end: (i + 1) * width, active: 0 }));
  for (const segment of segments) {
    const first = Math.max(0, Math.min(99, Math.floor(segment.start / width)));
    const last = Math.max(0, Math.min(99, Math.ceil(segment.end / width) - 1));
    for (let i = first; i <= last; i++) concurrency[i].active = Math.max(concurrency[i].active, segment.active);
  }
  const phases = ['blocked', 'dns', 'connect', 'send', 'wait', 'receive'].map(key => ({
    key, value: entries.reduce((sum, e) => sum + (e.phases.find(p => p.key === key)?.value ?? 0), 0),
  }));
  return {
    domains: breakdown(entries, e => e.host), types: breakdown(entries, e => e.type),
    statuses: breakdown(entries, e => e.status === 0 ? 'Network error' : `${Math.floor(e.status / 100)}xx`),
    concurrency, peakConcurrency: peak, busyMs: busy, idleMs: Math.max(0, span - busy), phases,
    totalWait: entries.reduce((sum, e) => sum + (e.wait ?? 0), 0),
  };
}
