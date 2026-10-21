import { formatBytes, formatDuration, MAX_BYTES } from '../lib/index.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const paths = {
  waterfall: '<path d="M4 5h6m-3 5h8m-4 5h9M2 3v16"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
  compare: '<path d="M8 3v18M16 3v18M3 7h9M12 17h9m-3-3 3 3-3 3M6 4 3 7l3 3"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  upload: '<path d="M12 15V3m-4 4 4-4 4 4M4 15v5h16v-5"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5"/>',
  file: '<path d="M13 3H5v18h14V9l-6-6Zm0 0v6h6M8 13h8m-8 4h6"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  reset: '<path d="M4 11a8 8 0 1 1 2 7M4 4v7h7"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 2v1"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  activity: '<path d="M2 12h5l3-8 4 16 3-8h5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  alert: '<path d="m12 3 10 17H2L12 3Z"/><path d="M12 9v5m0 2v1"/>',
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
hydrateIcons();
if (!navigator.platform?.includes('Mac')) $('#open-button kbd').textContent = 'Ctrl O';

const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
const pending = new Map();
let sequence = 0, analysis = null, comparison = null, sample = true, currentView = 'waterfall';
let limit = 100, findingFilter = null, toastTimer, searchTimer, loading = false;
worker.onmessage = ({ data }) => {
  const task = pending.get(data.id);
  if (!task) return;
  pending.delete(data.id);
  data.error ? task.reject(new Error(data.error)) : task.resolve(data.result);
};
worker.onerror = () => {
  for (const task of pending.values()) task.reject(new Error('The analysis worker stopped. Reload the page and try a smaller HAR.'));
  pending.clear();
};
function request(type, values = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, type, ...values });
  });
}
function toast(message, error = false) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.toggle('error', error);
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, error ? 9000 : 5000);
}
async function busy(work) {
  if (loading) return;
  loading = true;
  $('#busy').hidden = false;
  try { await work(); } catch (error) { toast(error.message, true); }
  finally { loading = false; $('#busy').hidden = true; }
}
function resetFilters() {
  $('#search').value = '';
  $('#type-filter').value = 'all';
  $('#status-filter').value = 'all';
  $('#sort').value = 'start';
  findingFilter = null;
  limit = 100;
}
async function loadFile(file, baseline = false) {
  if (!file) return;
  await busy(async () => {
    if (file.size > MAX_BYTES) throw new Error('This capture exceeds 50 MiB. Export a shorter recording.');
    const text = await file.text();
    const result = await request(baseline ? 'baseline' : 'load', { text, name: file.name });
    if (!baseline) { sample = false; resetFilters(); }
    applyResult(result);
    setView(baseline ? 'compare' : 'waterfall');
    toast(baseline ? 'Baseline added. Comparing endpoint medians.' : `${analysis.summary.count.toLocaleString()} requests analyzed. Your file stays on this device.`);
  });
}
async function loadDemo(baseline = false) {
  await busy(async () => {
    if (!baseline) await request('clear-baseline');
    const result = await request(baseline ? 'baseline' : 'load', { demo: true, name: baseline ? 'checkout-before.har' : 'checkout.har' });
    if (!baseline) { sample = true; resetFilters(); }
    applyResult(result);
    setView(baseline ? 'compare' : 'waterfall');
  });
}
function applyResult(result) {
  analysis = result.analysis;
  comparison = result.comparison;
  if (!analysis) return;
  $('#capture-name').textContent = analysis.name;
  $('#capture-meta').textContent = `${new Date(analysis.summary.start).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} · ${analysis.summary.domains} domains · HAR 1.2`;
  $('#sample-badge').hidden = !sample;
  $('#finding-count').textContent = analysis.findings.length;
  $('#warnings').hidden = !analysis.warnings.length;
  $('#warnings').innerHTML = analysis.warnings.map(w => `<p>${esc(w)}</p>`).join('');
  renderStats(); renderInsight(); renderRequests(); renderFindings(); renderComparison();
}
function spark(values, error = false) {
  const max = Math.max(...values, 1);
  return `<span class="stat-spark${error ? ' error' : ''}" aria-hidden="true">${values.slice(0, 12).map(v => `<i style="height:${Math.max(3, v / max * 23)}px"></i>`).join('')}</span>`;
}
function renderStats() {
  const s = analysis.summary;
  const duration = s.duration >= 1000 ? [(s.duration / 1000).toFixed(2), 's'] : [Math.round(s.duration), 'ms'];
  const bytes = formatBytes(s.totalTransfer).split(' ');
  const stats = [
    ['Total requests', s.count.toLocaleString(), '', 'layers', `<span>${s.domains} domains</span> in this capture`, analysis.entries.map(e => e.duration)],
    ['Capture span', duration[0], duration[1], 'clock', `p95 request: <span>${esc(formatDuration(s.p95))}</span>`, analysis.entries.map(e => e.wait ?? 0)],
    ['Transferred', (s.unknownTransfer ? '≥ ' : '') + bytes[0], bytes[1], 'download', s.unknownTransfer ? `${s.unknownTransfer} request sizes unknown` : 'Known network transfer · decimal units', analysis.entries.map(e => e.transfer ?? 0)],
    ['Failed requests', s.failed, '', 'activity', s.failed ? `<span>${(s.failed / s.count * 100).toFixed(1)}% of requests</span> need a closer look` : 'No HTTP errors or status 0 in this capture', analysis.entries.map(e => e.failed ? 20 : 3)],
  ];
  $('#stats').innerHTML = stats.map(([label, value, unit, glyph, footer, values], i) => `<article class="stat-card${i === 3 && s.failed ? ' has-error' : ''}"><div class="stat-top">${label}${icon(glyph)}</div><div class="stat-value">${value}<small>${unit}</small></div><div class="stat-bottom">${footer}</div>${spark(values)}</article>`).join('');
}
function renderInsight() {
  const slow = [...analysis.entries].filter(e => e.wait !== null).sort((a, b) => b.wait - a.wait)[0];
  const title = analysis.summary.slow ? 'A little waiting is adding up.' : analysis.findings.length ? 'A few signals stand out from the noise.' : 'A clean capture. A good place to start.';
  const detail = analysis.summary.slow ? `${shortName(slow)} spends ${formatDuration(slow.wait)} waiting for the first byte. Start your investigation there.` : `${analysis.findings.length} threshold-based findings across ${analysis.summary.count} requests. Explore the timing details for the full picture.`;
  $('#insight-strip').innerHTML = `<span class="insight-icon">${icon('spark')}</span><div><h3>${title}</h3><p>${esc(detail)}</p></div><button id="see-findings">Explore findings ↗</button>`;
  $('#see-findings').onclick = () => setView('findings');
}
function shortName(entry) {
  const url = new URL(entry.url);
  const name = url.pathname.split('/').filter(Boolean).at(-1) || url.host;
  try { return decodeURIComponent(name); } catch { return name; }
}
const glyphs = { document: '◇', fetch: '{ }', script: 'JS', stylesheet: '#', image: '▧', font: 'Aa', media: '▷', other: '·' };
function filteredEntries() {
  const term = $('#search').value.toLowerCase();
  const type = $('#type-filter').value, status = $('#status-filter').value;
  let rows = analysis.entries.filter(e => (!term || `${e.url} ${e.method} ${e.status}`.toLowerCase().includes(term)) &&
    (type === 'all' || e.type === type) && (!findingFilter || findingFilter.has(e.id)) &&
    (status === 'all' || status === 'failed' && e.failed || status === 'success' && e.status >= 200 && e.status < 300 || status === 'redirect' && e.status >= 300 && e.status < 400));
  if ($('#sort').value === 'slow') rows = rows.sort((a, b) => b.duration - a.duration);
  if ($('#sort').value === 'size') rows = rows.sort((a, b) => (b.transfer ?? -1) - (a.transfer ?? -1));
  return rows;
}
function renderRequests() {
  if (!analysis) return;
  const rows = filteredEntries();
  const shown = rows.slice(0, limit);
  const axis = Math.max(analysis.summary.duration * 1.04, 1);
  $('#time-axis').innerHTML = [0, .25, .5, .75, 1].map(n => `<span>${esc(formatDuration(n * axis))}</span>`).join('');
  $('#request-total').textContent = `${analysis.summary.count} total`;
  $('#visible-count').textContent = rows.length;
  $('#request-rows').innerHTML = shown.length ? shown.map(e => {
    const total = e.phases.reduce((sum, p) => sum + p.value, 0) || 1;
    const phaseBars = e.phases.filter(p => p.value > 0).map(p => `<span class="waterfall-phase phase-${p.key === 'wait' ? 'wait' : p.key === 'receive' ? 'receive' : 'network'}" style="width:${p.value / total * 100}%"></span>`).join('');
    return `<tr data-entry="${e.id}" class="${e.failed ? 'error-row' : ''}"><td><div class="request-name"><span class="type-icon ${e.type}" aria-label="${e.type}">${glyphs[e.type]}</span><div class="request-info"><button class="request-link" data-entry="${e.id}" title="${esc(e.url)}">${esc(shortName(e))}</button><div class="request-host"><span class="method-label">${esc(e.method)}</span>${esc(e.host)}</div></div></div></td><td><span class="status ${e.failed ? 'error' : e.status >= 300 ? 'redirect' : ''}">${e.status || 'ERR'}</span></td><td>${esc(formatBytes(e.transfer))}</td><td class="duration-cell${e.duration >= 600 ? ' slow' : ''}">${esc(formatDuration(e.duration))}</td><td><div class="waterfall-bar" style="margin-left:${e.offset / axis * 100}%;width:max(3px,${e.duration / axis * 100}%)" title="${esc(`${formatDuration(e.offset)} start · ${formatDuration(e.duration)} duration`)}">${phaseBars}</div></td></tr>`;
  }).join('') : '<tr><td colspan="5"><div class="empty-state"><h3>No requests match this view.</h3><p>Try a different filter or clear your search.</p><button class="button subtle" id="empty-reset">Reset filters</button></div></td></tr>';
  $('#table-summary').textContent = `Showing ${shown.length.toLocaleString()} of ${rows.length.toLocaleString()} requests${findingFilter ? ' · Finding filter active' : ''}`;
  $('#show-more').hidden = rows.length <= limit;
  if ($('#empty-reset')) $('#empty-reset').onclick = () => { resetFilters(); renderRequests(); };
}
function renderFindings() {
  $('#findings-list').innerHTML = analysis.findings.length ? analysis.findings.map((f, i) => `<article class="finding-card ${f.severity}"><span class="finding-number">0${i + 1}</span><div><h3>${esc(f.title)}</h3><p>${esc(f.detail)}</p><button class="text-button" data-finding="${esc(f.id)}">Inspect ${f.entryIds.length} request${f.entryIds.length === 1 ? '' : 's'} →</button></div><span class="severity">${f.severity}</span></article>`).join('') : `<div class="panel empty-state"><div class="empty-icon">${icon('shield')}</div><h3>No threshold-based findings.</h3><p>Nothing crossed the built-in thresholds. Explore the waterfall to inspect individual requests.<br>This is a focused network analysis, not a complete performance or security audit.</p></div>`;
  $$('[data-finding]').forEach(button => { button.onclick = () => {
    resetFilters(); findingFilter = new Set(analysis.findings.find(f => f.id === button.dataset.finding).entryIds);
    renderRequests(); setView('waterfall');
  }; });
}
function renderComparison() {
  if (!comparison) {
    $('#comparison').innerHTML = `<div class="panel empty-state"><div class="empty-icon">${icon('compare')}</div><span class="eyebrow" style="justify-content:center">BEFORE. AFTER. A CLEARER PICTURE.</span><h3>Did that change actually make it faster?</h3><p>Add an earlier HAR as your baseline. Compare endpoint medians,<br>spot regressions and see what changed between captures.</p><button class="button primary" id="compare-upload">${icon('upload')}Add baseline HAR</button>${sample ? '<button class="button subtle" id="demo-baseline">Try demo comparison ↗</button>' : ''}<p class="privacy-note">The open capture is “after”. Your baseline is “before”.</p></div>`;
    $('#compare-upload').onclick = () => $('#baseline-input').click();
    if ($('#demo-baseline')) $('#demo-baseline').onclick = () => loadDemo(true);
    return;
  }
  const changed = comparison.endpoints.filter(e => e.state !== 'stable');
  $('#comparison').innerHTML = `<div class="compare-bar"><p><strong>${esc(comparison.baseline)}</strong> → <strong>${esc(comparison.current)}</strong><br>Endpoint medians · Query values ignored · Regressions ≥ 100 ms and 20%</p><button class="button subtle small" id="clear-baseline">${icon('close')}Remove baseline</button></div><div class="compare-stats">${[['Regressions', comparison.regressions], ['Improvements', comparison.improved], ['New endpoints', comparison.added], ['Removed endpoints', comparison.removed]].map(([label, value]) => `<div class="compare-stat"><strong>${value}</strong><span>${label}</span></div>`).join('')}</div><div class="panel"><div class="panel-heading"><div><h2>What changed <span>${changed.length}</span></h2><p>${comparison.endpoints.length} endpoints across both captures</p></div></div><div class="table-scroll"><table class="comparison-table"><thead><tr><th>ENDPOINT</th><th>BASELINE</th><th>CURRENT</th><th>CHANGE</th></tr></thead><tbody>${changed.length ? changed.slice(0, 200).map(e => `<tr><td>${esc(e.key)}<div class="request-host">${e.beforeCount} → ${e.afterCount} requests</div></td><td>${e.beforeCount ? esc(formatDuration(e.previous)) : '—'}</td><td>${e.afterCount ? esc(formatDuration(e.current)) : '—'}</td><td><span class="state-pill ${e.state}">${e.state === 'regression' || e.state === 'improved' ? `${e.delta > 0 ? '+' : ''}${Math.round(e.delta)} ms · ` : ''}${e.state}</span></td></tr>`).join('') : '<tr><td colspan="4">No endpoint crossed the change thresholds.</td></tr>'}</tbody></table></div><p class="comparison-note">${changed.length > 200 ? 'Showing the first 200 changed endpoints. ' : ''}Matched by method, origin, path and query names. Repeated endpoints use median duration. Compare like-for-like recordings: cache state, network conditions and workload can affect results.</p></div>`;
  $('#clear-baseline').onclick = () => busy(async () => { applyResult(await request('clear-baseline')); toast('Baseline removed.'); });
}
const headings = {
  waterfall: ['Waterfall', 'See the whole request.', 'Find the bottlenecks. Connect the dots. Ship a faster experience.'],
  findings: ['Findings', 'Less noise. More signal.', 'Turn a wall of network requests into a focused investigation.'],
  compare: ['Compare captures', 'Make every change count.', 'A closer look at what got faster, slower, or simply different.'],
};
function setView(view) {
  if (!headings[view]) return;
  currentView = view;
  $$('[data-view]').forEach(b => { b.classList.toggle('active', b.dataset.view === view); b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false'); });
  $$('.view').forEach(el => { el.hidden = el.id !== `${view}-view`; });
  $('#breadcrumb-view').textContent = headings[view][0];
  $('#page-title').textContent = headings[view][1];
  $('#page-description').textContent = headings[view][2];
}
function showDetail(id) {
  const e = analysis?.entries.find(entry => entry.id === Number(id));
  if (!e) return;
  const max = Math.max(...e.phases.map(p => p.value), 1);
  $('#detail-content').innerHTML = `<div class="dialog-heading"><span class="eyebrow">REQUEST DETAILS</span><button class="icon-button" id="close-detail" aria-label="Close request details">${icon('close')}</button></div><h2 class="detail-title">${esc(shortName(e))}</h2><span class="status ${e.failed ? 'error' : ''}">${e.status || 'ERR'}</span> <span class="outline-badge">${esc(e.method)} · ${esc(e.type)}</span><p class="detail-url">${esc(e.url)}</p><div class="detail-meta">${[['Duration', formatDuration(e.duration)], ['Transferred', formatBytes(e.transfer)], ['Start offset', formatDuration(e.offset)], ['Protocol', e.protocol || 'Not recorded']].map(([name, value]) => `<div><span>${name}</span><strong>${esc(value)}</strong></div>`).join('')}</div><h3>Where the time went</h3>${e.phases.map(p => `<div class="phase-detail"><span>${esc(({ blocked: 'Queueing', dns: 'DNS lookup', connect: 'Connection', send: 'Sending', wait: 'Waiting (TTFB)', receive: 'Receiving' })[p.key])}</span><span class="phase-detail-bar"><i style="width:${p.value / max * 100}%"></i></span><strong>${formatDuration(p.value)}</strong></div>`).join('')}<p class="detail-note">TLS negotiation: ${formatDuration(e.ssl)} (already included in connection time). Unavailable phases display as 0. The waterfall normalizes recorded phases to the request’s total duration.</p><h3>Response metadata</h3><p class="detail-url">Content-Type: ${esc(e.mime || 'Not recorded')}<br>Cache-Control: ${esc(e.cacheControl || 'Not recorded')}<br>Decoded content: ${esc(formatBytes(e.decoded))}</p><p class="detail-note">Query values, URL credentials and fragments are hidden. Bodies, cookies and raw headers are deliberately excluded from this view. URL paths and query names may still contain sensitive information.</p>`;
  $('#close-detail').onclick = () => $('#detail-dialog').close();
  $('#detail-dialog').showModal();
}
function download(text, name, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadName(extension) { return (analysis?.name || 'capture').replace(/\.(har|json)$/i, '').replace(/[^\p{L}\p{N}_.-]/gu, '_').slice(0, 80) + extension; }
async function exportFile(type) {
  $('#export-menu').hidden = true;
  $('#export-button').setAttribute('aria-expanded', 'false');
  if (!analysis) return;
  await busy(async () => {
    const result = await request(type);
    download(result.text, downloadName(type === 'report' ? '.report.md' : '.sanitized.har'), type === 'report' ? 'text/markdown' : 'application/json');
    toast(type === 'report' ? 'Report exported. Review URL paths before sharing.' : `Sanitized HAR exported. ${result.stats.redactedHeaders} header values redacted. Review paths before sharing.`);
  });
}

$('#open-button').onclick = () => $('#file-input').click();
$('#baseline-button').onclick = () => $('#baseline-input').click();
$('#file-input').onchange = event => { loadFile(event.target.files[0]); event.target.value = ''; };
$('#baseline-input').onchange = event => { loadFile(event.target.files[0], true); event.target.value = ''; };
$('#demo-button').onclick = () => loadDemo();
$$('[data-view]').forEach(button => { button.onclick = () => setView(button.dataset.view); });
$('#search').oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { findingFilter = null; limit = 100; renderRequests(); }, 120); };
['#type-filter', '#status-filter', '#sort'].forEach(selector => { $(selector).onchange = () => { limit = 100; renderRequests(); }; });
$('#reset-filters').onclick = () => { resetFilters(); renderRequests(); };
$('#show-more').onclick = () => { limit += 100; renderRequests(); };
$('#request-rows').onclick = event => { const row = event.target.closest('[data-entry]'); if (row) showDetail(row.dataset.entry); };
$('#guide-button').onclick = $('#help-button').onclick = () => $('#help-dialog').showModal();
$('.close-help').onclick = () => $('#help-dialog').close();
['#help-dialog', '#detail-dialog'].forEach(selector => { $(selector).addEventListener('click', event => {
  const rect = event.currentTarget.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close();
}); });
$('#export-button').onclick = () => { const open = $('#export-menu').hidden; $('#export-menu').hidden = !open; $('#export-button').setAttribute('aria-expanded', String(open)); };
$('#export-report').onclick = () => exportFile('report');
$('#export-har').onclick = () => exportFile('sanitize');
document.addEventListener('click', event => { if (!event.target.closest('.export-wrap')) { $('#export-menu').hidden = true; $('#export-button').setAttribute('aria-expanded', 'false'); } });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { $('#export-menu').hidden = true; $('#export-button').setAttribute('aria-expanded', 'false'); return; }
  if (event.ctrlKey || event.metaKey) { if (event.key.toLowerCase() === 'o') { event.preventDefault(); if (!loading) $('#file-input').click(); } return; }
  if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName) || $('dialog[open]') || loading) return;
  if (event.key === '/') { event.preventDefault(); setView('waterfall'); $('#search').focus(); }
  if (['1', '2', '3'].includes(event.key)) setView(['waterfall', 'findings', 'compare'][Number(event.key) - 1]);
});
let dragDepth = 0;
document.addEventListener('dragenter', event => { if (event.dataTransfer?.types.includes('Files')) { event.preventDefault(); dragDepth++; $('#drop-overlay').hidden = false; } });
document.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('Files')) event.preventDefault(); });
document.addEventListener('dragleave', event => { if (--dragDepth <= 0) { dragDepth = 0; $('#drop-overlay').hidden = true; } });
document.addEventListener('drop', event => { event.preventDefault(); dragDepth = 0; $('#drop-overlay').hidden = true; if (event.dataTransfer?.files.length > 1) toast('Open one capture at a time. Use Add baseline for a comparison.', true); else loadFile(event.dataTransfer?.files[0]); });

setView(currentView);
loadDemo();
