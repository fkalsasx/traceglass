export const DEFAULT_CONFIG = Object.freeze({
  slowWaitMs: 600, slowWaitRatio: 0.6, largeTransferBytes: 500_000,
  regressionMs: 100, regressionPercent: 20,
  budgets: Object.freeze({ p95Ms: 1500, transferBytes: 2_000_000, requests: 100, failed: 0 }),
});

export function normalizeConfig(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Configuration must be a JSON object.');
  for (const key of Object.keys(input)) if (!Object.hasOwn(DEFAULT_CONFIG, key)) throw new Error(`Unknown configuration field: ${key}`);
  const config = { ...DEFAULT_CONFIG, ...input, budgets: { ...DEFAULT_CONFIG.budgets } };
  if (input.budgets !== undefined) {
    if (!input.budgets || typeof input.budgets !== 'object' || Array.isArray(input.budgets)) throw new Error('budgets must be an object. Use null on an individual limit to disable it.');
    for (const key of Object.keys(input.budgets)) {
      if (!Object.hasOwn(DEFAULT_CONFIG.budgets, key)) throw new Error(`Unknown budget: ${key}`);
      config.budgets[key] = input.budgets[key];
    }
  }
  for (const key of ['slowWaitMs', 'slowWaitRatio', 'largeTransferBytes', 'regressionMs', 'regressionPercent']) {
    if (!Number.isFinite(config[key]) || config[key] < 0) throw new Error(`${key} must be a finite nonnegative number.`);
  }
  if (config.slowWaitRatio > 1) throw new Error('slowWaitRatio must be between 0 and 1.');
  for (const [key, value] of Object.entries(config.budgets)) {
    if (value !== null && (!Number.isFinite(value) || value < 0 || ['requests', 'failed'].includes(key) && !Number.isInteger(value))) throw new Error(`Budget ${key} must be a nonnegative ${['requests', 'failed'].includes(key) ? 'integer' : 'number'}, or null.`);
  }
  return config;
}

export function evaluateBudgets(summary, limits) {
  const definitions = [
    ['p95Ms', 'p95 request duration', summary.p95, 'ms'],
    ['transferBytes', 'Known transfer', summary.totalTransfer, 'bytes'],
    ['requests', 'Request count', summary.count, 'count'],
    ['failed', 'Failed requests', summary.failed, 'count'],
  ];
  return definitions.filter(([key]) => limits[key] !== null).map(([key, label, actual, unit]) => ({
    key, label, actual, limit: limits[key], unit,
    status: actual > limits[key] ? 'fail' : key === 'transferBytes' && summary.unknownTransfer > 0 ? 'unknown' : 'pass',
  }));
}
