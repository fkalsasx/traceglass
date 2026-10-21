<div align="center">

<img src="web/favicon.svg" width="68" alt="Traceglass logo">

# Traceglass

### See the whole request.

**A local network workbench that turns HAR files into a story you can actually follow.**

Waterfall viewer · Before/after comparison · Sanitized exports · CI performance budgets

[![CI](https://github.com/fkalsasx/traceglass/actions/workflows/ci.yml/badge.svg)](https://github.com/fkalsasx/traceglass/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-5f8050)](LICENSE)
![Runtime dependencies: 0](https://img.shields.io/badge/runtime_dependencies-0-153e35)
![Node.js 22+](https://img.shields.io/badge/node-%E2%89%A522-739959)

[Quick start](#quick-start) · [CLI](#use-it-in-your-terminal) · [Privacy](#what-stays-private) · [Türkçe](README.tr.md)

</div>

![Traceglass analyzing a synthetic checkout capture](docs/workspace.jpg)

Your checkout feels slow. DevTools shows a wall of requests. A teammate asks for the trace—but it contains session cookies and response bodies.

Traceglass helps you understand the capture, compare it with yesterday’s version, and export a focused report. Analysis happens on your device. There is no backend, account, API key, analytics, CDN, or dependency installation.

## Quick start

Requires [Node.js 22 or newer](https://nodejs.org/).

```sh
git clone https://github.com/fkalsasx/traceglass.git
cd traceglass
npm start
```

Open **http://127.0.0.1:4273**. The synthetic checkout demo loads immediately. Drop your own `.har` file anywhere, or choose **Open HAR file**.

No `npm install` step. The browser app and CLI use only platform APIs.

## A useful first minute

1. **Follow the waterfall.** Filter by URL, method, resource type or status. Sort by start time, duration or transfer size. Select a request to inspect its timing phases.
2. **Investigate the evidence.** Findings highlight HTTP failures, long first-byte waits, large transfers and static assets without captured Cache-Control headers. Each finding opens its affected requests.
3. **Compare a baseline.** Open Compare captures → Try demo comparison. The bundled example identifies three endpoint regressions. Bring your own baseline to compare a real change.
4. **Export with intention.** Download a Markdown report for an issue, or a sanitized HAR that drops bodies, cookies and custom extension fields. Review the result before sharing.

| Capability | Browser | CLI / library |
| --- | :---: | :---: |
| Waterfall, filters and timing details | ✓ | Structured timing data |
| Actionable, deterministic findings | ✓ | ✓ |
| Endpoint median comparison | ✓ | ✓ |
| Sanitized HAR / Markdown report | ✓ | ✓ |
| JSON output and CI exit codes | — | ✓ |
| Accounts, uploads, runtime dependencies | 0 | 0 |

## Use it in your terminal

```sh
# A readable summary
node bin/traceglass.mjs analyze examples/checkout.har

# Compare with a baseline and save an issue-ready report
node bin/traceglass.mjs analyze examples/checkout.har \
  --baseline examples/checkout-before.har \
  --format markdown --output report.md

# Redact a capture into a NEW file; never overwrites an existing file
node bin/traceglass.mjs sanitize examples/checkout.har --output clean.har

# Set a CI gate: fail on HTTP failures, regressions, or a p95 over 800 ms
node bin/traceglass.mjs analyze current.har --baseline baseline.har \
  --fail-on-errors --fail-on-regression --max-p95 800

# Machine-readable analysis, with query values hidden
node bin/traceglass.mjs analyze examples/checkout.har --format json
```

In PowerShell, put each command on one line (the `\` continuation above is for POSIX shells).

Exit codes: **0** success, **1** invalid input or IO error, **2** a requested CI gate failed. Run `node bin/traceglass.mjs --help` for all flags. To get a `traceglass` command locally, run `npm link`; this repository is not advertised as a published npm package.

The demo prints:

```text
TRACEGLASS  ·  checkout.har

  Requests       19 (2 failed)
  Capture span   2.52 s
  Transfer       1.65 MB
  p95 request    2.14 s
  Domains        3

COMPARISON  ·  checkout-before.har → checkout.har
  3 regressions · 0 improvements · 0 added · 0 removed
```

### Use the same engine in code

```js
import { readFile } from 'node:fs/promises';
import { analyzeHar, compareHar, sanitizeHar, createReport } from './lib/index.js';

const capture = await readFile('examples/checkout.har', 'utf8');
const analysis = analyzeHar(capture, 'checkout.har');
console.log(analysis.summary);
console.log(createReport(analysis));
const { har, stats } = sanitizeHar(capture);
```

## What stays private

- The browser reads files into a **module worker**. It never posts their contents to a server. The local server serves application assets and rejects POST requests.
- Captures remain **in memory**. There is no local storage, IndexedDB, telemetry or third-party font request. Reloading clears them. Browser/OS memory management is outside the application’s control.
- The view model hides query values, URL credentials and fragments. It excludes bodies, cookies and raw request/response headers. The timing panel shows only selected response metadata.
- Sanitized HAR exports rebuild a small set of known HAR fields. Cookies, bodies, comments, page metadata, IP addresses and unknown extensions are dropped. Query values are replaced; non-allowlisted header values become `[REDACTED]`.
- **URL paths, domains, query names, header names, timestamps and allowlisted metadata remain.** These can still identify people or contain secrets. Sanitization is a conservative convenience, not a security guarantee. Inspect exports before sharing.

Read the [exact export policy](docs/PRIVACY.md). Only synthetic captures are included in this repository. Real `.har` files are ignored by Git by default.

## How the numbers work

- **Capture span:** latest request finish minus earliest request start. Parallel request durations are not summed. This is not a browser page-load metric.
- **Transfer:** `_transferSize` where available, otherwise nonnegative `bodySize` plus known `headersSize`. Unknown values are excluded and reported. Decoded content size is separate. Units are decimal kB/MB.
- **p95:** nearest-rank 95th percentile of request duration. This is a property of this recording, not a statistical service SLO.
- **Comparison:** match method + origin + path + sorted query names, ignoring values. Repeated matches use medians. A regression requires **both ≥100 ms and ≥20%**. A zero baseline requires the absolute threshold.
- **Timing:** TLS/SSL is already part of HAR’s connection phase. It is never counted twice. Missing/negative phases contribute zero to visualization; recorded phases are normalized to the reported total duration.

The parser follows [HAR 1.2 timing semantics](https://www.softwareishard.com/blog/har-12-spec/#timings). See [methodology and limits](docs/METHODOLOGY.md) for the heuristics and supported scope.

## Develop and deploy

```sh
npm test        # Core, redaction, comparison, CLI and local-server tests
npm run check   # JavaScript syntax checks
npm run build   # Static app in dist/
```

Serve `dist/` with any static host. Relative asset URLs support subpaths such as GitHub Pages project sites. Opening `index.html` directly with `file://` is not supported; module workers require an HTTP(S) origin.

For GitHub Pages, select **Settings → Pages → Source → GitHub Actions**, then run the **Deploy demo** workflow. It builds and deploys the exact same browser app. No application backend is provisioned.

```text
lib/         Shared pure-JavaScript engine
web/         Browser workspace and module worker
bin/         Zero-dependency Node.js CLI
scripts/     Local server, syntax check, static build
examples/    Deterministic synthetic before/after captures
test/        Node.js built-in test runner
```

## Contribute

Small, useful improvements are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). Please use synthetic or thoroughly reviewed captures in issues. Report security concerns through the process in [SECURITY.md](SECURITY.md).

Possible next steps: page-level selection, configurable thresholds, and an opt-in exact-query matching mode. These are ideas, not shipped features.

If Traceglass made an investigation easier, a star helps other developers find it. Released under the [MIT license](LICENSE).
