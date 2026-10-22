import { formatBytes, formatDuration } from './har.js';

// Escape untrusted capture text so Markdown cannot create links, images or extra rows.
export function markdownText(value) {
  return String(value).replace(/[\r\n\t]+/g, ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}\[\]()#+.!|~-]/g, '\\$&');
}

export function createReport(analysis, comparison = null) {
  const s = analysis.summary;
  const lines = ['# Traceglass network report', '', `Capture: ${markdownText(analysis.name)}`, ...(analysis.pageId !== null && analysis.pageId !== undefined ? [`Page scope: ${markdownText(analysis.pageId || 'Unassigned requests')}`] : []), '',
    '| Requests | Failed | Capture span | Known transfer | p95 request |', '| --- | --- | --- | --- | --- |',
    `| ${s.count} | ${s.failed} | ${formatDuration(s.duration)} | ${formatBytes(s.totalTransfer)} | ${formatDuration(s.p95)} |`, '',
    '> URLs have query values, credentials and fragments removed. Paths and query names remain. Review before sharing. Bodies and headers are not included.', '',
    '## Findings', ''];
  if (!analysis.findings.length) lines.push('No threshold-based findings. This is not a complete performance or security audit.', '');
  for (const f of analysis.findings) lines.push(`- **${markdownText(f.title)}** — ${markdownText(f.detail)}`);
  if (analysis.budgets) {
    lines.push('', '## Performance budgets', '', '| Budget | Actual | Limit | Result |', '| --- | --- | --- | --- |');
    for (const b of analysis.budgets) lines.push(`| ${b.label} | ${b.unit === 'bytes' ? formatBytes(b.actual) : b.unit === 'ms' ? formatDuration(b.actual) : b.actual} | ${b.unit === 'bytes' ? formatBytes(b.limit) : b.unit === 'ms' ? formatDuration(b.limit) : b.limit} | ${b.status} |`);
  }
  if (analysis.overview) {
    lines.push('', '## Domain breakdown', '', '| Domain | Requests | Known transfer | Failed |', '| --- | --- | --- | --- |');
    for (const d of analysis.overview.domains.slice(0, 20)) lines.push(`| ${markdownText(d.name)} | ${d.count} | ${formatBytes(d.transfer)} | ${d.failed} |`);
  }
  if (analysis.warnings.length) lines.push('', '## Capture limitations', '', ...analysis.warnings.map(w => `- ${markdownText(w)}`));
  lines.push('', '## Slowest requests', '', '| Method | URL | Status | Duration | Transfer |', '| --- | --- | --- | --- | --- |');
  for (const e of [...analysis.entries].sort((a, b) => b.duration - a.duration).slice(0, 10)) lines.push(`| ${markdownText(e.method)} | ${markdownText(e.url)} | ${e.status} | ${formatDuration(e.duration)} | ${formatBytes(e.transfer)} |`);
  if (comparison) {
    lines.push('', '## Comparison', '', `Baseline: ${markdownText(comparison.baseline)}`, '', `${comparison.regressions} regressions · ${comparison.improved} improvements · ${comparison.added} added · ${comparison.removed} removed endpoints.`, '',
      `Matched by method, origin, path and query names. Repeated endpoints use median duration. Regression threshold: at least ${comparison.config?.regressionMs ?? 100} ms and ${comparison.config?.regressionPercent ?? 20}%. ${comparison.newFailures ?? 0} previously successful endpoints now have failures. Captures may differ in network, cache and workload.`, '',
      '| Endpoint | Baseline median | Current median | State | Failures before → after |', '| --- | --- | --- | --- | --- |');
    for (const e of comparison.endpoints.filter(e => e.state !== 'stable' || e.newFailure).slice(0, 30)) lines.push(`| ${markdownText(e.key)} | ${e.beforeCount ? formatDuration(e.previous) : '—'} | ${e.afterCount ? formatDuration(e.current) : '—'} | ${e.state}${e.newFailure ? ' · new failure' : ''} | ${e.beforeFailed ?? 0} → ${e.afterFailed ?? 0} |`);
  }
  return lines.join('\n') + '\n';
}
