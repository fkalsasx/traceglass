import { analyzeHar, parseHar, compareHar, sanitizeHar, createReport, createHtmlReport, createCsv, normalizeConfig } from '../lib/index.js';
import { createDemo } from './demo.js';
import { answerQuestion } from '../lib/assistant.js';

let document = null, baselineDocument = null, analysis = null, baseline = null;
let config = normalizeConfig(), pageId = null, baselinePageId = null;
let name = 'capture.har', baselineName = 'baseline.har';
function analyze(doc, captureName, page, profile) {
  return doc ? analyzeHar(doc, captureName, { config: profile, ...(page === null ? {} : { pageId: page }) }) : null;
}
self.onmessage = ({ data: message }) => {
  const { id, type, text, demo } = message;
  try {
    if (type === 'load' || type === 'baseline') {
      const parsed = parseHar(demo ? createDemo(type === 'baseline') : text);
      const next = analyze(parsed, message.name, null, config);
      if (type === 'load') { document = parsed; analysis = next; name = message.name; pageId = null; }
      else { baselineDocument = parsed; baseline = next; baselineName = message.name; baselinePageId = null; }
    }
    if (type === 'scope' || type === 'config') {
      const nextConfig = type === 'config' ? normalizeConfig(message.config) : config;
      const nextPage = type === 'scope' && !message.baseline ? message.pageId : pageId;
      const nextBaselinePage = type === 'scope' && message.baseline ? message.pageId : baselinePageId;
      const next = analyze(document, name, nextPage, nextConfig);
      const nextBaseline = analyze(baselineDocument, baselineName, nextBaselinePage, nextConfig);
      config = nextConfig; pageId = nextPage; baselinePageId = nextBaselinePage;
      analysis = next; baseline = nextBaseline;
    }
    if (type === 'clear-baseline') { baselineDocument = null; baseline = null; baselinePageId = null; }
    const comparison = baseline && analysis ? compareHar(baseline, analysis, { config }) : null;
    if (type === 'assistant') {
      self.postMessage({ id, result: answerQuestion({ question: message.question, context: message.context, analysis, comparison }) });
      return;
    }
    if (['sanitize', 'report', 'html', 'csv'].includes(type)) {
      if (!analysis) throw new Error('Open a capture first.');
      if (type === 'sanitize') {
        const ids = new Set(analysis.entries.map(e => e.id));
        const scoped = { log: { ...document.log, entries: document.log.entries.filter((_, index) => ids.has(index)) } };
        const result = sanitizeHar(scoped);
        self.postMessage({ id, result: { text: JSON.stringify(result.har, null, 2), stats: result.stats } });
      } else self.postMessage({ id, result: { text: type === 'report' ? createReport(analysis, comparison) : type === 'html' ? createHtmlReport(analysis, comparison) : createCsv(analysis) } });
      return;
    }
    self.postMessage({ id, result: { analysis, comparison, config, baselineMeta: baseline ? { name: baseline.name, pages: baseline.pages, pageId: baseline.pageId } : null } });
  } catch (error) { self.postMessage({ id, error: error.message }); }
};
