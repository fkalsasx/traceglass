# Traceglass network report

Capture: checkout\.har

| Requests | Failed | Capture span | Known transfer | p95 request |
| --- | --- | --- | --- | --- |
| 19 | 2 | 2.52 s | 1.65 MB | 2.14 s |

> URLs have query values, credentials and fragments removed. Paths and query names remain. Review before sharing. Bodies and headers are not included.

## Findings

- **2 failed requests** — Inspect HTTP errors and requests with status 0\. A status of 0 may indicate a cancelled, blocked or failed request\.
- **3 long server waits** — At least 600 ms and 60% of the request spent waiting for the first byte\. Check backend traces, cache misses and network latency\.
- **2 large transfers** — At least 500 kB transferred per request\. Check compression, code splitting and image dimensions\.
- **4 static assets without Cache\-Control** — No Cache\-Control response header was captured\. Verify caching policy; HAR metadata alone cannot determine browser cache behavior\.

## Slowest requests

| Method | URL | Status | Duration | Transfer |
| --- | --- | --- | --- | --- |
| GET | https://store\.example\.com/api/recommendations | 503 | 2.14 s | 1.0 kB |
| GET | https://store\.example\.com/api/cart | 200 | 1.49 s | 6.5 kB |
| GET | https://store\.example\.com/api/shipping?country=REDACTED | 200 | 972 ms | 2.6 kB |
| GET | https://cdn\.example\.com/images/checkout\-hero\.webp | 200 | 424 ms | 864.4 kB |
| GET | https://store\.example\.com/assets/vendor\.js | 200 | 338 ms | 525.0 kB |
| GET | https://store\.example\.com/api/payment\-methods | 200 | 326 ms | 4.0 kB |
| GET | https://store\.example\.com/api/session | 200 | 242 ms | 2.0 kB |
| GET | https://store\.example\.com/api/inventory?sku=REDACTED | 200 | 186 ms | 1.4 kB |
| GET | https://store\.example\.com/checkout | 200 | 184 ms | 12.6 kB |
| GET | https://cdn\.example\.com/images/linen\-shirt\.webp | 200 | 175 ms | 42.6 kB |

## Comparison

Baseline: checkout\-before\.har

3 regressions · 0 improvements · 0 added · 0 removed endpoints.

Matched by method, origin, path and query names. Repeated endpoints use median duration. Regression threshold: at least 100 ms and 20%. Captures may differ in network, cache and workload.

| Endpoint | Baseline median | Current median | State |
| --- | --- | --- | --- |
| GET https://store\.example\.com/api/recommendations | 480 ms | 2.14 s | regression |
| GET https://store\.example\.com/api/cart | 340 ms | 1.49 s | regression |
| GET https://store\.example\.com/api/shipping?country | 280 ms | 972 ms | regression |
