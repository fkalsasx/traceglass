import { analyzeHar, parseHar, compareHar, sanitizeHar, createReport } from '../lib/index.js';
import { createDemo } from './demo.js';

let document = null, analysis = null, baseline = null;
self.onmessage = ({ data: message }) => {
  const { id, type, text, name, demo } = message;
  try {
    if (type === 'load' || type === 'baseline') {
      const parsed = parseHar(demo ? createDemo(type === 'baseline') : text);
      const next = analyzeHar(parsed, name);
      if (type === 'load') { document = parsed; analysis = next; }
      else baseline = next;
    }
    if (type === 'clear-baseline') baseline = null;
    if (type === 'sanitize') {
      if (!document) throw new Error('Open a capture first.');
      const result = sanitizeHar(document);
      self.postMessage({ id, result: { text: JSON.stringify(result.har, null, 2), stats: result.stats } });
      return;
    }
    const comparison = baseline && analysis ? compareHar(baseline, analysis) : null;
    if (type === 'report') {
      if (!analysis) throw new Error('Open a capture first.');
      self.postMessage({ id, result: { text: createReport(analysis, comparison) } });
      return;
    }
    self.postMessage({ id, result: { analysis, comparison } });
  } catch (error) { self.postMessage({ id, error: error.message }); }
};
