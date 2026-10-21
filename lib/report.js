import { formatBytes, formatDuration } from './har.js';

// Escape untrusted capture text so Markdown cannot create links, images or extra rows.
export function markdownText(value) {
  return String(value).replace(/[\r\n\t]+/g, ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}\[\]()#+.!|~-]/g, '\\$&');
}

export function createReport(analysis, comparison = null) {
  const s = analysis.summary;
  const lines = ['# Traceglass network report', '', `Capture: ${markdownText(analysis.name)}`, '',
    '| Requests | Failed | Capture span | Known transfer | p95 request |', '| --- | --- | --- | --- | --- |',
    `| ${s.count} | ${s.failed} | ${formatDuration(s.duration)} | ${formatBytes(s.totalTransfer)} | ${formatDuration(s.p95)} |`, '',
    '> URLs have query values, credentials and fragments removed. Paths and query names remain. Review before sharing. Bodies and headers are not included.', '',
    '## Findings', ''];
  if (!analysis.findings.length) lines.push('No threshold-based findings. This is not a complete performance or security audit.', '');
  for (const f of analysis.findings) lines.push(`- **${markdownText(f.title)}** — ${markdownText(f.detail)}`);
  if (analysis.warnings.length) lines.push('', '## Capture limitations', '', ...analysis.warnings.map(w => `- ${markdownText(w)}`));
  lines.push('', '## Slowest requests', '', '| Method | URL | Status | Duration | Transfer |', '| --- | --- | --- | --- | --- |');
  for (const e of [...analysis.entries].sort((a, b) => b.duration - a.duration).slice(0, 10)) lines.push(`| ${markdownText(e.method)} | ${markdownText(e.url)} | ${e.status} | ${formatDuration(e.duration)} | ${formatBytes(e.transfer)} |`);
  if (comparison) {
    lines.push('', '## Comparison', '', `Baseline: ${markdownText(comparison.baseline)}`, '', `${comparison.regressions} regressions · ${comparison.improved} improvements · ${comparison.added} added · ${comparison.removed} removed endpoints.`, '',
      'Matched by method, origin, path and query names. Repeated endpoints use median duration. Regression threshold: at least 100 ms and 20%. Captures may differ in network, cache and workload.', '',
      '| Endpoint | Baseline median | Current median | State |', '| --- | --- | --- | --- |');
    for (const e of comparison.endpoints.filter(e => e.state !== 'stable').slice(0, 30)) lines.push(`| ${markdownText(e.key)} | ${e.beforeCount ? formatDuration(e.previous) : '—'} | ${e.afterCount ? formatDuration(e.current) : '—'} | ${e.state} |`);
  }
  return lines.join('\n') + '\n';
}
