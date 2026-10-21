# Methodology and limits

## Input

Traceglass accepts a JSON HAR object with `log.entries`. It tolerates missing optional fields; this is not a full HAR schema validator. Invalid JSON, empty captures, captures over 50 MiB and more than 50,000 entries are rejected. Browser file size is checked before reading. Entries missing request/response, a valid timestamp or an HTTP(S)/WS(S) URL are skipped with a warning. An entirely unreadable capture is rejected.

HAR 1.2 is the target. Only HTTP metadata is interpreted; a WebSocket handshake may appear as a request but WebSocket frames are not analyzed. Multiple HAR pages are combined in one timeline. Bodies are not decoded, executed or rendered.

## Timing

`entry.time` takes precedence when nonnegative and finite. Otherwise duration is the sum of available nonnegative blocked, DNS, connect, send, wait and receive phases. SSL is a subset of connect, as defined in [HAR 1.2](https://www.softwareishard.com/blog/har-12-spec/#timings), and is never added again.

Requests are ordered by timestamp with stable input-index ties. Capture span includes idle gaps and parallelism. It is not DOMContentLoaded, onLoad, LCP, INP or a Core Web Vital. The waterfall scales phase widths to the reported total if the recorded phases do not sum exactly. Missing phases display zero; zero is not proof that a phase took no time.

p95 uses the nearest-rank definition. Median averages the two center values for even-length sets. These metrics describe one recording; a controlled repeated measurement is needed for performance claims.

## Sizes

Transfer uses response `_transferSize` when nonnegative, including zero for cached requests. Otherwise it uses nonnegative response `bodySize` plus known nonnegative `headersSize`. If the body size is unknown, the whole transfer size is unknown. Totals sum known values only and warn when incomplete. Decoded `content.size` is displayed separately and is not substituted for network transfer. Units are decimal, not binary.

## Findings

| Finding | Threshold | What it does not prove |
| --- | --- | --- |
| Failed request | Status 0 or ≥400 | Status 0 can mean cancellation, blocking or a transport failure. |
| Long server wait | Wait ≥600 ms **and** ≥60% of request duration | High TTFB can include network latency; it does not identify a backend cause. |
| Large transfer | Known transfer ≥500,000 bytes | A large file may be intentional and appropriate. |
| Missing Cache-Control | GET, status 200, static resource type, no captured header | This is not a complete browser caching assessment; Expires and heuristic caching exist. |

Resource types are inferred from MIME types, with an `/api/` path fallback for otherwise unknown content. Vendor-specific HAR resource classification is not required.

## Comparison

Keys contain method, URL origin, pathname and unique sorted query names. Query values and fragments are excluded. Dynamic path segments are not normalized. Changes in query values may represent different workloads; grouping those is a convenience that should be checked against the capture’s purpose.

Repeated endpoints are aggregated using the median duration of each capture. At least 100 ms **and** 20% slower is a regression. At least 100 ms **and** 20% faster is an improvement. With a zero-duration baseline, a current median of at least 100 ms is a regression. Added/removed endpoints are separate categories.

The UI shows the first 200 changed endpoints, the Markdown report the first 30, and CLI JSON all endpoints. The request table initially renders 100 rows and can show more. Search/filter covers all parsed requests, not just displayed rows.

## Deliberate limits

No remote URL import, request replay, packet capture, AI diagnosis, body rendering, historical storage or automated capture is implemented. No service worker caches the app for a future offline visit. The app makes no claim to replace DevTools, a security scanner or a controlled benchmark suite.
