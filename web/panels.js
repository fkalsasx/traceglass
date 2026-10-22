import { formatBytes, formatDuration, DEFAULT_CONFIG } from '../lib/index.js';
import { escapeHtml as esc } from '../lib/exports.js';

const $ = selector => document.querySelector(selector);
const titles = { document: 'Documents', script: 'JavaScript', stylesheet: 'Stylesheets', image: 'Images', fetch: 'Fetch / XHR', font: 'Fonts', media: 'Media', other: 'Other' };
const palette = ['#315e48', '#85ac70', '#c0d998', '#cfb784', '#98b9ba', '#9f9aba', '#c2a58f', '#cbd2c2'];
export function pageOptions(pages, selected) {
  return '<option value="*">All pages</option>' + pages.map(p => `<option value="${esc(JSON.stringify(p.id))}"${selected === p.id ? ' selected' : ''}>${esc(p.label)} (${p.count})</option>`).join('');
}
function budgetValue(value, unit) { return unit === 'bytes' ? formatBytes(value) : unit === 'ms' ? formatDuration(value) : value; }

export function renderOverview(analysis, handlers) {
  const { overview: o, summary: s } = analysis;
  const max = Math.max(o.peakConcurrency, 1);
  const points = o.concurrency.map((bin, i) => `${i * 8},${140 - bin.active / max * 110}`).join(' ');
  const pass = analysis.budgets.filter(b => b.status === 'pass').length;
  const phaseTotal = o.phases.reduce((sum, p) => sum + p.value, 0) || 1;
  const totalBytes = Math.max(s.totalTransfer, 1);
  const typeSegments = o.types.map((type, i) => `<span style="width:${type.transfer / totalBytes * 100}%;background:${palette[i % palette.length]}" title="${esc(titles[type.name])}: ${formatBytes(type.transfer)}"></span>`).join('');
  $('#overview').innerHTML = `
    <div class="overview-grid">
      <section class="panel activity-panel"><div class="panel-heading"><div><h2>The rhythm of your network</h2><p>Concurrent requests throughout this capture</p></div><span class="outline-badge">${o.peakConcurrency} PEAK</span></div>
        <div class="activity-chart"><div class="chart-y"><span>${max}</span><span>${Math.round(max / 2)}</span><span>0</span></div><svg viewBox="0 0 800 155" preserveAspectRatio="none" role="img" aria-label="Network concurrency: peak ${o.peakConcurrency} requests"><path d="M0 30H800M0 85H800M0 140H800" stroke="#e9eedf" stroke-dasharray="3 5"/><polygon points="0,140 ${points} 800,140" fill="#e2edcf"/><polyline points="${points}" fill="none" stroke="#6f9855" stroke-width="2" vector-effect="non-scaling-stroke"/></svg><div class="chart-x"><span>0 ms</span><span>${formatDuration(s.duration / 2)}</span><span>${formatDuration(s.duration)}</span></div></div>
        <div class="activity-facts"><div><span>Peak concurrency</span><strong>${o.peakConcurrency}<small> requests</small></strong></div><div><span>Network active</span><strong>${formatDuration(o.busyMs)}</strong></div><div><span>Idle gaps</span><strong>${formatDuration(o.idleMs)}</strong></div></div>
      </section>
      <section class="budget-spotlight"><span class="eyebrow">KEEP YOUR SHIP IN SHAPE</span><h2>A little budget.<br>A lot more confidence.</h2><div class="budget-fraction">${pass}<span>/ ${analysis.budgets.length}</span></div><p>${analysis.budgets.length ? 'performance budgets passed' : 'budgets enabled'}</p><div class="budget-dots">${analysis.budgets.map(b => `<span class="${b.status}" title="${esc(b.label)}: ${b.status}"></span>`).join('')}</div><button id="overview-budgets">Review budgets <span>↗</span></button></section>
      <section class="panel domain-panel"><div class="panel-heading"><div><h2>Where the bytes go</h2><p>Domains ranked by known transfer · select one to investigate</p></div><span class="outline-badge">${s.domains} DOMAINS</span></div><div class="domain-list">${o.domains.slice(0, 12).map((d, i) => `<button class="domain-row" data-domain="${esc(d.name)}"><span class="domain-number">${String(i + 1).padStart(2, '0')}</span><span class="domain-info"><strong>${esc(d.name)}</strong><small>${d.count} requests${d.failed ? ` · ${d.failed} failed` : ''}</small><span class="mini-track"><i style="width:${d.transfer / Math.max(o.domains[0]?.transfer ?? 1, 1) * 100}%"></i></span></span><span class="domain-value">${d.unknownTransfer ? '≥ ' : ''}${formatBytes(d.transfer)}<small>${formatDuration(d.median)} median</small></span><span>↗</span></button>`).join('')}</div>${o.domains.length > 12 ? `<p class="panel-note">Showing the 12 largest domains of ${o.domains.length}. Search any domain in Waterfall.</p>` : ''}</section>
      <section class="panel type-panel"><div class="panel-heading"><div><h2>What you’re loading</h2><p>Transfer by resource type</p></div></div><div class="transfer-stack">${typeSegments}</div><div class="type-list">${o.types.map((t, i) => `<button data-type="${esc(t.name)}"><span class="color-dot" style="background:${palette[i % palette.length]}"></span><strong>${esc(titles[t.name] ?? t.name)}</strong><small>${t.count} requests</small><span>${formatBytes(t.transfer)}</span></button>`).join('')}</div><p class="panel-note">${s.unknownTransfer ? `${s.unknownTransfer} unknown request sizes are excluded.` : 'Known network bytes; decoded content is not counted here.'}</p></section>
      <section class="panel timing-panel"><div class="panel-heading"><div><h2>Where the time went</h2><p>Recorded phase time summed across requests, including parallel work</p></div></div><div class="phase-stack">${o.phases.map((p, i) => `<span style="width:${p.value / phaseTotal * 100}%;background:${palette[i]}"></span>`).join('')}</div><div class="timing-legend">${o.phases.map((p, i) => `<div><span class="color-dot" style="background:${palette[i]}"></span><span>${({ blocked: 'Queueing', dns: 'DNS', connect: 'Connection', send: 'Sending', wait: 'Waiting', receive: 'Receiving' })[p.key]}</span><strong>${formatDuration(p.value)}</strong></div>`).join('')}</div></section>
      <section class="panel quick-findings"><div class="panel-heading"><div><h2>Start your investigation</h2><p>The most useful signals in this recording</p></div></div>${analysis.findings.length ? analysis.findings.slice(0, 3).map(f => `<button data-overview-finding="${esc(f.id)}"><span class="signal-dot ${f.severity}"></span><span>${esc(f.title)}</span><span>→</span></button>`).join('') : '<p class="panel-note">No configured finding threshold was crossed.</p>'}<button id="overview-findings" class="all-findings">Explore all findings ↗</button></section>
    </div>`;
  $('#overview-budgets').onclick = handlers.onBudgets;
  $('#overview-findings').onclick = handlers.onFindings;
  document.querySelectorAll('[data-domain]').forEach(button => { button.onclick = () => handlers.onFilter(`domain:${button.dataset.domain}`); });
  document.querySelectorAll('[data-type]').forEach(button => { button.onclick = () => handlers.onFilter(`type:${button.dataset.type}`); });
  document.querySelectorAll('[data-overview-finding]').forEach(button => { button.onclick = () => handlers.onFinding(button.dataset.overviewFinding); });
}

export function renderBudgets(analysis, handlers) {
  const profile = analysis.config;
  const fields = [ ['p95Ms', 'p95 request duration', 'ms', 1], ['transferBytes', 'Total network transfer', 'kB', 1000], ['requests', 'Request count', 'requests', 1], ['failed', 'Failed requests', 'requests', 1] ];
  $('#budgets').innerHTML = `<div class="section-heading"><div><h2>Fast is a feature. Give it a budget.</h2><p>Limits apply to the selected page. Blank limits are disabled. Profiles stay in memory.</p></div><button class="button subtle small" id="download-profile">Export profile JSON ↗</button></div>
    <div class="budget-checks">${analysis.budgets.map(b => `<article class="budget-check ${b.status}"><div><span class="result-chip ${b.status}">${b.status.toUpperCase()}</span><span>${esc(b.label)}</span></div><strong>${budgetValue(b.actual, b.unit)}<small> / ${budgetValue(b.limit, b.unit)}</small></strong><div class="budget-meter"><i style="width:${Math.min(100, b.limit ? b.actual / b.limit * 100 : b.actual ? 100 : 0)}%"></i></div><p>${b.status === 'unknown' ? 'Missing transfer sizes prevent a verified pass.' : b.status === 'fail' ? 'Over budget. Follow the waterfall to investigate.' : 'Within this limit for the selected capture.'}</p></article>`).join('') || '<div class="panel empty-state"><h3>No budgets enabled.</h3><p>Add limits below to start measuring.</p></div>'}</div>
    <form id="budget-form" class="panel profile-form"><div class="panel-heading"><div><h2>Your performance profile</h2><p>Export the same JSON profile for use with the CLI’s --config option.</p></div></div><div class="profile-fields">${fields.map(([key, label, unit, divisor]) => `<label>${label}<span class="input-unit"><input type="number" name="${key}" aria-label="${label} budget" min="0" step="${key === 'transferBytes' || key === 'p95Ms' ? 'any' : '1'}" value="${profile.budgets[key] === null ? '' : profile.budgets[key] / divisor}" placeholder="Disabled"><span>${unit}</span></span></label>`).join('')}</div>
    <details class="threshold-details"><summary>Finding & comparison thresholds</summary><div class="profile-fields threshold-fields">${[['slowWaitMs', 'Long wait minimum', 'ms', 1], ['slowWaitRatio', 'Wait share of request', '%', .01], ['largeTransferBytes', 'Large transfer threshold', 'kB', 1000], ['regressionMs', 'Regression minimum', 'ms', 1], ['regressionPercent', 'Regression change', '%', 1]].map(([key, label, unit, divisor]) => `<label>${label}<span class="input-unit"><input name="${key}" type="number" min="0" ${key === 'slowWaitRatio' ? 'max="100"' : ''} step="any" required value="${Number((profile[key] / divisor).toFixed(6))}"><span>${unit}</span></span></label>`).join('')}</div></details><p class="profile-note">A regression must exceed both the absolute and percentage thresholds. Unknown transfer sizes produce an “unknown” budget result, never a false pass. Loading a new capture keeps this profile; reloading the page resets it.</p><div class="profile-actions"><button type="button" class="button subtle" id="reset-profile">Restore defaults</button><button type="submit" class="button primary">Apply profile →</button></div></form>`;
  $('#download-profile').onclick = () => handlers.onDownload(profile);
  $('#reset-profile').onclick = () => handlers.onConfig(DEFAULT_CONFIG);
  $('#budget-form').onsubmit = event => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const data = new FormData(event.currentTarget), budgets = {};
    for (const [key, , , divisor] of fields) budgets[key] = String(data.get(key)).trim() === '' ? null : Number(data.get(key)) * divisor;
    const next = { budgets };
    for (const key of ['slowWaitMs', 'slowWaitRatio', 'largeTransferBytes', 'regressionMs', 'regressionPercent']) next[key] = Number(data.get(key)) * (key === 'slowWaitRatio' ? .01 : key === 'largeTransferBytes' ? 1000 : 1);
    handlers.onConfig(next);
  };
}

export function renderCompare(comparison, baselineMeta, handlers) {
  if (!comparison) {
    $('#comparison').innerHTML = `<div class="panel empty-state"><div class="empty-icon">${handlers.icon('compare')}</div><span class="eyebrow" style="justify-content:center">BEFORE. AFTER. A CLEARER PICTURE.</span><h3>Did that change actually make it faster?</h3><p>Compare endpoint medians, new failures and transferred bytes.<br>Add an earlier HAR, or paste a baseline JSON capture.</p><button class="button primary" id="compare-upload">Add baseline HAR</button><button class="button subtle" id="compare-paste">Paste baseline JSON</button>${handlers.sample ? '<button class="button subtle" id="demo-baseline">Try demo comparison ↗</button>' : ''}</div>`;
    $('#compare-upload').onclick = handlers.onUpload;
    $('#compare-paste').onclick = handlers.onPaste;
    if ($('#demo-baseline')) $('#demo-baseline').onclick = handlers.onDemo;
    return;
  }
  $('#comparison').innerHTML = `<div class="compare-bar"><p><strong>${esc(comparison.baseline)}</strong> → <strong>${esc(comparison.current)}</strong><br>Endpoint medians · Query values ignored · ≥${comparison.config.regressionMs} ms and ≥${comparison.config.regressionPercent}%</p><div class="baseline-tools"><label>Baseline page<select id="baseline-page-filter" aria-label="Select baseline page">${pageOptions(baselineMeta.pages, baselineMeta.pageId)}</select></label><button class="button subtle small" id="clear-baseline">Remove baseline</button></div></div>
    <div class="compare-stats">${[['Regressions', comparison.regressions], ['Improvements', comparison.improved], ['New failures', comparison.newFailures], ['New endpoints', comparison.added], ['Removed', comparison.removed]].map(([label, value]) => `<div class="compare-stat"><strong>${value}</strong><span>${label}</span></div>`).join('')}</div>
    <div class="panel"><div class="panel-heading"><div><h2>What changed</h2><p>${comparison.endpoints.length} endpoints · Inspect a current endpoint to see its request details</p></div></div><div class="toolbar compare-toolbar"><div class="search-field"><input id="compare-search" aria-label="Search compared endpoints" placeholder="Find an endpoint…"></div><select id="compare-state" aria-label="Filter comparison"><option value="changed">All changes</option><option value="regression">Regressions</option><option value="failures">New failures</option><option value="improved">Improvements</option><option value="added">Added</option><option value="removed">Removed</option><option value="all">All endpoints</option></select></div><div class="table-scroll"><table class="comparison-table"><thead><tr><th>ENDPOINT</th><th>BASELINE</th><th>CURRENT</th><th>CHANGE</th><th>FAILURES</th></tr></thead><tbody id="comparison-rows"></tbody></table></div><div class="table-footer"><span id="comparison-count"></span><button id="comparison-more" class="text-button" hidden>Show 100 more ↓</button></div><p class="comparison-note">Matched by method, origin, path and query names. Repeated endpoints use median duration. Page scopes are independent. Cache, network conditions and workload can affect the result. Transfer deltas use known bytes only.</p></div>`;
  let limit = 100;
  function rows() {
    const term = $('#compare-search').value.toLowerCase(), state = $('#compare-state').value;
    const filtered = comparison.endpoints.filter(e => e.key.toLowerCase().includes(term) && (state === 'all' || state === 'changed' && (e.state !== 'stable' || e.newFailure) || state === 'failures' && e.newFailure || e.state === state));
    $('#comparison-rows').innerHTML = filtered.slice(0, limit).map(e => `<tr><td>${e.entryIds.length ? `<button class="endpoint-link" data-compared-entry="${e.entryIds[0]}">${esc(e.key)}</button>` : esc(e.key)}<div class="request-host">${e.beforeCount} → ${e.afterCount} requests · ${e.afterTransfer - e.beforeTransfer >= 0 ? '+' : '−'}${formatBytes(Math.abs(e.afterTransfer - e.beforeTransfer))} transfer</div></td><td>${e.beforeCount ? formatDuration(e.previous) : '—'}</td><td>${e.afterCount ? formatDuration(e.current) : '—'}</td><td><span class="state-pill ${e.state}">${e.state}</span><div class="request-host">${e.beforeCount && e.afterCount ? `${e.delta > 0 ? '+' : ''}${Math.round(e.delta)} ms${e.percent === null ? '' : ` · ${e.percent > 0 ? '+' : ''}${e.percent.toFixed(1)}%`}` : ''}</div></td><td><span class="${e.newFailure ? 'new-failure' : ''}">${e.beforeFailed} → ${e.afterFailed}${e.newFailure ? ' new' : ''}</span></td></tr>`).join('') || '<tr><td colspan="5">No endpoints match these filters.</td></tr>';
    $('#comparison-count').textContent = `${Math.min(limit, filtered.length)} of ${filtered.length} endpoints`;
    $('#comparison-more').hidden = filtered.length <= limit;
    document.querySelectorAll('[data-compared-entry]').forEach(b => { b.onclick = () => handlers.onInspect(Number(b.dataset.comparedEntry)); });
  }
  $('#compare-search').oninput = () => { limit = 100; rows(); };
  $('#compare-state').onchange = () => { limit = 100; rows(); };
  $('#comparison-more').onclick = () => { limit += 100; rows(); };
  $('#clear-baseline').onclick = handlers.onClear;
  $('#baseline-page-filter').onchange = event => handlers.onScope(event.target.value === '*' ? null : JSON.parse(event.target.value));
  rows();
}
