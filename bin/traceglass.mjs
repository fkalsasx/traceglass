#!/usr/bin/env node
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { analyzeHar, compareHar, sanitizeHar, createReport, createHtmlReport, createCsv, normalizeConfig, formatBytes, formatDuration, MAX_BYTES } from '../lib/index.js';

const HELP = `traceglass — see the whole request.

Usage:
  traceglass view [--port 4273]
  traceglass analyze <capture.har> [options]
  traceglass sanitize <capture.har> --output <clean.har>

Analyze options:
  --baseline <file>       Compare endpoint medians with an earlier capture
  --format <format>       text (default), json, markdown, html, or csv
  --config <file>         JSON thresholds and budgets; fail on exceeded/unknown budgets
  --page <pageref>        Analyze one HAR page (baseline remains all pages)
  --baseline-page <id>    Select a page in the baseline capture
  --query <expression>    Filter before analysis: 'status:5xx time:>500ms'
  --output <file>         Write a new file instead of stdout (never overwrites)
  --fail-on-errors       Exit 2 if requests have status 0 or >= 400
  --fail-on-regression   Exit 2 on regressions; requires --baseline
  --max-p95 <ms>          Exit 2 if p95 request duration exceeds this budget

Exit codes: 0 success · 1 invalid input / IO error · 2 budget exceeded
Node.js 22+ · No uploads · No runtime dependencies
`;

function terminalSafe(value) { return String(value).replace(/[\x00-\x1f\x7f-\x9f]/g, ''); }
async function load(file) {
  const info = await stat(file);
  if (!info.isFile()) throw new Error('Input must be a file.');
  if (info.size > MAX_BYTES) throw new Error('HAR exceeds the 50 MiB limit.');
  return readFile(file, 'utf8');
}
function textReport(analysis, comparison) {
  const s = analysis.summary;
  const lines = ['TRACEGLASS  ·  ' + terminalSafe(analysis.name), '',
    `  Requests       ${s.count} (${s.failed} failed)`,
    `  Capture span   ${formatDuration(s.duration)}`,
    `  Transfer       ${s.unknownTransfer ? 'at least ' : ''}${formatBytes(s.totalTransfer)}`,
    `  p95 request    ${formatDuration(s.p95)}`,
    `  Domains        ${s.domains}`, '', 'FINDINGS'];
  if (!analysis.findings.length) lines.push('  No threshold-based findings.');
  for (const f of analysis.findings) lines.push(`  [${f.severity.toUpperCase()}] ${terminalSafe(f.title)}`, `    ${terminalSafe(f.detail)}`);
  if (analysis.warnings.length) lines.push('', ...analysis.warnings.map(w => `  Note: ${terminalSafe(w)}`));
  if (comparison) lines.push('', `COMPARISON  ·  ${terminalSafe(comparison.baseline)} → ${terminalSafe(comparison.current)}`, `  ${comparison.regressions} regressions · ${comparison.improved} improvements · ${comparison.added} added · ${comparison.removed} removed`);
  lines.push('', 'BUDGETS', ...analysis.budgets.map(b => `  [${b.status.toUpperCase()}] ${b.label}: ${b.actual} / ${b.limit} ${b.unit}`));
  lines.push('', '  Run with --format markdown for a shareable report. Review URL paths before sharing.');
  return lines.join('\n') + '\n';
}

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, strict: true, options: {
    help: { type: 'boolean', short: 'h' }, version: { type: 'boolean', short: 'v' },
    baseline: { type: 'string' }, format: { type: 'string', default: 'text' }, output: { type: 'string', short: 'o' },
    config: { type: 'string' }, page: { type: 'string' }, 'baseline-page': { type: 'string' }, query: { type: 'string' },
    port: { type: 'string', default: '4273' }, 'fail-on-errors': { type: 'boolean' }, 'fail-on-regression': { type: 'boolean' }, 'max-p95': { type: 'string' },
  } });
  const [command, file, ...extra] = positionals;
  if (values.version) console.log('2.0.0');
  else if (values.help || !command) console.log(HELP);
  else if (command === 'view') {
    if (file) throw new Error('view takes no file arguments. Open a HAR in the browser.');
    const port = Number(values.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port.');
    const { startServer } = await import('../scripts/serve.mjs');
    startServer(port);
  } else {
    if (!['analyze', 'sanitize'].includes(command)) throw new Error(`Unknown command: ${terminalSafe(command)}. Use --help.`);
    if (!file || extra.length) throw new Error('Provide exactly one input HAR file. Use --help for examples.');
    if (!['text', 'json', 'markdown', 'html', 'csv'].includes(values.format)) throw new Error('Format must be text, json, markdown, html or csv.');
    if (values['baseline-page'] !== undefined && !values.baseline) throw new Error('--baseline-page requires --baseline.');
    if (values['fail-on-regression'] && !values.baseline) throw new Error('--fail-on-regression requires --baseline.');
    const budget = values['max-p95'] === undefined ? null : Number(values['max-p95']);
    if (budget !== null && (!Number.isFinite(budget) || budget < 0)) throw new Error('--max-p95 must be a nonnegative number of milliseconds.');
    if (command === 'sanitize' && !values.output) throw new Error('Sanitizing requires --output <new-file.har>. The source is never overwritten.');
    let output, failed = false;
    const input = await load(file);
    if (command === 'sanitize') {
      const result = sanitizeHar(input);
      output = JSON.stringify(result.har, null, 2) + '\n';
      process.stderr.write(`Redacted ${result.stats.redactedHeaders} header values; removed bodies, cookies and custom fields. URL paths and query names remain. Review before sharing.\n`);
    } else {
      const config = normalizeConfig(values.config ? JSON.parse(await load(values.config)) : undefined);
      const analysis = analyzeHar(input, path.basename(file), { config, ...(values.page === undefined ? {} : { pageId: values.page }), query: values.query });
      const baseline = values.baseline ? analyzeHar(await load(values.baseline), path.basename(values.baseline), { config, ...(values['baseline-page'] === undefined ? {} : { pageId: values['baseline-page'] }) }) : null;
      const comparison = baseline ? compareHar(baseline, analysis) : null;
      output = values.format === 'json' ? JSON.stringify({ ...analysis, comparison }, null, 2) + '\n' : values.format === 'markdown' ? createReport(analysis, comparison) : values.format === 'html' ? createHtmlReport(analysis, comparison) : values.format === 'csv' ? createCsv(analysis) : textReport(analysis, comparison);
      failed = Boolean(values['fail-on-errors'] && analysis.summary.failed || values['fail-on-regression'] && comparison?.regressions || budget !== null && analysis.summary.p95 > budget || values.config && analysis.budgets.some(b => b.status !== 'pass'));
    }
    if (values.output) { await writeFile(values.output, output, { flag: 'wx' }); process.stderr.write(`Wrote ${terminalSafe(values.output)}\n`); }
    else process.stdout.write(output);
    if (failed) process.exitCode = 2;
  }
} catch (error) {
  process.stderr.write(`Traceglass: ${terminalSafe(error.code === 'EEXIST' ? 'Output already exists. Choose a new path; files are never overwritten.' : error.message)}\n`);
  process.exitCode = 1;
}
