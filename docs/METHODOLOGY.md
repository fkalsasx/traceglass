# Methodology and limits

## Input

Traceglass accepts a JSON HAR object with `log.entries`. It tolerates missing optional fields; this is not a full HAR schema validator. Invalid JSON, empty captures, captures over 50 MiB and more than 50,000 entries are rejected. Browser file size is checked before reading. Entries missing request/response, a valid timestamp or an HTTP(S)/WS(S) URL are skipped with a warning. An entirely unreadable capture is rejected.

HAR 1.2 is the target. Only HTTP metadata is interpreted; a WebSocket handshake may appear as a request but WebSocket frames are not analyzed. Multiple HAR pages are combined by default. A page selector can scope each capture independently by `pageref`; requests with no reference form an Unassigned group. Scope changes reset the time origin and recompute all aggregates. Bodies are not decoded, executed or rendered.

## Timing

`entry.time` takes precedence when nonnegative and finite. Otherwise duration is the sum of available nonnegative blocked, DNS, connect, send, wait and receive phases. SSL is a subset of connect, as defined in [HAR 1.2](https://www.softwareishard.com/blog/har-12-spec/#timings), and is never added again.

Requests are ordered by timestamp with stable input-index ties. Capture span includes idle gaps and parallelism. It is not DOMContentLoaded, onLoad, LCP, INP or a Core Web Vital. The waterfall scales phase widths to the reported total if the recorded phases do not sum exactly. Missing phases display zero; zero is not proof that a phase took no time.

p95 uses the nearest-rank definition. Median averages the two center values for even-length sets. These metrics describe one recording; a controlled repeated measurement is needed for performance claims.

## Sizes

Transfer uses response `_transferSize` when nonnegative, including zero for cached requests. Otherwise it uses nonnegative response `bodySize` plus known nonnegative `headersSize`. If the body size is unknown, the whole transfer size is unknown. Totals sum known values only and warn when incomplete. Decoded `content.size` is displayed separately and is not substituted for network transfer. Units are decimal, not binary.

## Findings

The following are defaults. They can be changed through an analysis profile in the browser or CLI. Failure status and missing Cache-Control rules are fixed.

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

The comparison table initially shows 100 endpoints with search, state filters and progressive expansion. Markdown includes up to 30 changed or newly failing endpoints; HTML includes 50; CLI JSON includes all. An endpoint is newly failing when it existed in the baseline with zero failures and has at least one failure in the current capture. This is independent of duration classification.

The waterfall renders 100 rows per page with next/previous controls. Search/filter covers all parsed requests in the current page scope, not just visible rows. Comparisons, summary metrics and browser exports are independent of table search. CLI `--query` filters the current capture before analysis; it does not filter the baseline.

## Overview and budgets

Peak concurrency uses half-open intervals: a request ending at a timestamp does not overlap a request starting at that timestamp. Zero-duration requests contribute no active time. Network-active time is the union of all request intervals; idle time is the remaining capture span. The chart uses 100 equal time bins and shows the peak within each bin. Summed phase time includes overlapping work and is not capture elapsed time.

Domain and resource summaries sum known transfer bytes, count failures and compute median duration within each group. Unknown sizes are reported and excluded. A zero-byte capture still has meaningful request counts even when its transfer bars have no width.

Default budgets: p95 ≤1500 ms, known transfer ≤2,000,000 bytes, ≤100 requests and ≤0 failed requests. Values exactly at their limits pass. A transfer result below its limit with missing sizes is unknown; a known overage fails even with missing sizes. Disable a budget with `null`. Partial profiles inherit unspecified defaults. The browser keeps profiles in memory; exported JSON can be reused with CLI `--config`, which enforces every enabled budget and exits 2 for either failed or unknown results.

## Search syntax

Whitespace-separated terms are combined with AND. Double quotes group phrases. A leading `-` negates a term. Fields: `domain`, `method`, `type`, `status`, `time`, `size`, `is`. Text fields use case-insensitive substring matching; `is:failed` and `is:success` use status semantics. Status supports `5xx` and numeric comparisons. Time units are `ms` or `s`; size units are `b`, `kb`, `mb` (decimal). Operators: `>`, `>=`, `<`, `<=`, `=`. Unknown sizes never match a numeric size predicate. Invalid field values produce an error instead of silently dropping the filter. Plain URLs remain literal text terms.

## Deliberate limits

No remote URL import, request replay, packet capture, AI diagnosis, body rendering, historical storage or automated capture is implemented. No service worker caches the app for a future offline visit. The app makes no claim to replace DevTools, a security scanner or a controlled benchmark suite.
