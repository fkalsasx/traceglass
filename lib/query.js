const fields = new Set(['domain', 'method', 'type', 'status', 'time', 'size', 'is']);

function numericPredicate(field, expression) {
  if (field === 'status' && /^[1-5]xx$/i.test(expression)) {
    const group = Number(expression[0]);
    return entry => Math.floor(entry.status / 100) === group;
  }
  const match = expression.match(/^(>=|<=|>|<|=)?(\d+(?:\.\d+)?)(ms|s|b|kb|mb)?$/i);
  if (!match) throw new Error(`Invalid ${field} filter. Try ${field}:${field === 'status' ? '5xx' : '>500'}.`);
  const [, operator = '=', amount, rawUnit = ''] = match, unit = rawUnit.toLowerCase();
  if (field === 'time' && !['', 'ms', 's'].includes(unit) || field === 'size' && !['', 'b', 'kb', 'mb'].includes(unit) || field === 'status' && unit) throw new Error(`Invalid unit for ${field}.`);
  const target = Number(amount) * ({ s: 1000, kb: 1000, mb: 1_000_000 }[unit] ?? 1);
  if (!Number.isFinite(target)) throw new Error(`Invalid ${field} value.`);
  return entry => {
    const value = field === 'time' ? entry.duration : field === 'size' ? entry.transfer : entry.status;
    if (value === null) return false;
    return operator === '>' ? value > target : operator === '>=' ? value >= target : operator === '<' ? value < target : operator === '<=' ? value <= target : value === target;
  };
}

/** Whitespace-separated AND terms. Quotes group a phrase; a leading - negates a term. */
export function compileQuery(input = '') {
  const tokens = input.match(/(?:[^\s"]|"[^"]*")+/g) ?? [];
  if ((input.match(/"/g)?.length ?? 0) % 2) throw new Error('Close the quotation mark in your search.');
  const predicates = tokens.map(raw => {
    const negative = raw.startsWith('-') && raw.length > 1;
    const token = (negative ? raw.slice(1) : raw).replaceAll('"', '');
    const colon = token.indexOf(':'), field = token.slice(0, colon).toLowerCase();
    let predicate;
    if (colon > 0 && fields.has(field)) {
      const value = token.slice(colon + 1);
      if (!value) throw new Error(`Provide a value after ${field}:`);
      if (['status', 'time', 'size'].includes(field)) predicate = numericPredicate(field, value);
      else if (field === 'is') {
        if (!['failed', 'success'].includes(value.toLowerCase())) throw new Error('Use is:failed or is:success.');
        predicate = entry => value.toLowerCase() === 'failed' ? entry.failed : entry.status >= 200 && entry.status < 300;
      } else predicate = entry => String(field === 'domain' ? entry.host : entry[field]).toLowerCase().includes(value.toLowerCase());
    } else predicate = entry => `${entry.url} ${entry.method} ${entry.status}`.toLowerCase().includes(token.toLowerCase());
    return negative ? entry => !predicate(entry) : predicate;
  });
  return entry => predicates.every(test => test(entry));
}
