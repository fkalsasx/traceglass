/** Deterministic, synthetic data. No real users, services or credentials. */
export function createDemo(baseline = false) {
  const start = Date.parse('2026-10-21T09:41:00.000Z');
  const specs = [
    ['https://store.example.com/checkout', 0, 200, 184, 12400, 'text/html'],
    ['https://store.example.com/assets/app.css', 190, 200, 86, 18600, 'text/css'],
    ['https://store.example.com/assets/vendor.js', 194, 200, 338, 524800, 'application/javascript'],
    ['https://store.example.com/assets/checkout.js', 198, 200, 156, 84300, 'application/javascript'],
    ['https://cdn.example.com/fonts/inter-latin.woff2', 218, 200, 124, 48200, 'font/woff2'],
    ['https://store.example.com/api/session', 366, 200, 242, 1800, 'application/json'],
    ['https://store.example.com/api/cart', 372, 200, baseline ? 340 : 1486, 6300, 'application/json'],
    ['https://store.example.com/api/recommendations', 380, baseline ? 200 : 503, baseline ? 480 : 2142, 820, 'application/json'],
    ['https://cdn.example.com/images/linen-shirt.webp', 420, 200, 175, 42400, 'image/webp'],
    ['https://cdn.example.com/images/canvas-tote.webp', 425, 200, 142, 32100, 'image/webp'],
    ['https://cdn.example.com/images/checkout-hero.webp', 432, 200, 424, 864200, 'image/webp'],
    ['https://store.example.com/api/shipping?country=TR', 622, 200, baseline ? 280 : 972, 2400, 'application/json'],
    ['https://store.example.com/api/payment-methods', 630, 200, 326, 3800, 'application/json'],
    ['https://analytics.example.com/v1/events', 712, 204, 92, 210, 'application/json', 'POST'],
    ['https://store.example.com/assets/payment-icons.svg', 970, 200, 64, 4600, 'image/svg+xml'],
    ['https://store.example.com/api/inventory?sku=DEMO-001', 1870, 200, 186, 1200, 'application/json'],
    ['https://store.example.com/api/discount', 1874, baseline ? 200 : 404, 148, 680, 'application/json', 'POST'],
    ['https://analytics.example.com/v1/events', 2100, 204, 106, 210, 'application/json', 'POST'],
    ['https://store.example.com/assets/favicon.svg', 2400, 200, 52, 1600, 'image/svg+xml'],
  ];
  return { log: { version: '1.2', creator: { name: 'Traceglass synthetic demo', version: '1.0' }, pages: [{ id: 'checkout', title: 'Demo checkout', startedDateTime: new Date(start).toISOString(), pageTimings: { onContentLoad: 960, onLoad: 2452 } }], entries: specs.map(([url, offset, status, time, size, mimeType, method = 'GET'], i) => ({
    pageref: 'checkout', startedDateTime: new Date(start + offset).toISOString(), time,
    request: { method, url, httpVersion: 'HTTP/2', headers: [{ name: 'accept', value: mimeType }, { name: 'authorization', value: 'Bearer DEMO_NOT_A_REAL_TOKEN' }], cookies: [{ name: 'demo-session', value: 'synthetic-session' }], queryString: [...new URL(url).searchParams].map(([name, value]) => ({ name, value })), headersSize: 120, bodySize: 0, ...(method === 'POST' ? { postData: { mimeType: 'application/json', text: '{"demo":true}' } } : {}) },
    response: { status, statusText: status === 503 ? 'Service Unavailable' : status === 404 ? 'Not Found' : 'OK', httpVersion: 'HTTP/2', headers: [{ name: 'content-type', value: mimeType }, ...(['text/css', 'font/woff2', 'image/webp'].includes(mimeType) ? [{ name: 'cache-control', value: 'public, max-age=31536000, immutable' }] : []), { name: 'set-cookie', value: 'demo=synthetic; Secure' }], cookies: [], content: { size: size * 2, mimeType, text: 'Synthetic response body' }, redirectURL: '', headersSize: 180, bodySize: size, _transferSize: size + 180 },
    cache: {}, timings: { blocked: 2, dns: i === 0 ? 12 : 0, connect: i === 0 ? 40 : 0, ssl: i === 0 ? 28 : 0, send: 2, wait: time > 600 ? time - 40 : Math.max(0, time - (i === 0 ? 92 : 40)), receive: i === 0 ? 36 : 36 },
  })) } };
}
