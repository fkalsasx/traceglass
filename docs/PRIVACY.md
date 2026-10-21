# Export policy

Traceglass is a local analysis tool, not a complete data loss prevention system. Review every output before sending it to someone else.

## Browser and CLI analysis

Analysis does not make network requests. The browser fetches its own application assets from its origin. The Node CLI uses local file IO. Neither loads remote resources from request URLs found in a HAR.

The browser worker retains the current raw HAR in memory so it can create a sanitized export. The main thread receives a reduced view model. No browser storage APIs or analytics are used. Baselines are held as reduced analysis, not as raw documents. File names appear in the interface and reports.

## Sanitized HAR

The sanitizer **reconstructs** the document rather than searching the input for particular secret patterns. Unknown fields are discarded.

| Field | Export behavior |
| --- | --- |
| Request URL / redirect URL | Remove user/password and fragment; replace all query values with `REDACTED`. HTTP(S) and WS(S) only. |
| URL domain, path and query names | Retained; may still be sensitive. Duplicate query values collapse to one redacted value. |
| Cookies and cookie arrays | Arrays emptied. Cookie-related header values are redacted. |
| Request postData / response content.text | Entire bodies omitted, including params and base64 content. |
| Header values | Only Content-Type, Content-Length, Content-Encoding, Cache-Control, Accept and Accept-Encoding are retained. All others become `[REDACTED]`. Header names remain. |
| Response content metadata | Size and MIME type retained. |
| Status / method / HTTP version | Retained. Status text is blanked. |
| Timings / sizes / timestamps | Retained where numeric/valid. Missing required timing phases normalize to zero. |
| Page titles / page metadata / cache metadata | Omitted or emptied. |
| IP address / connection ID / comments | Omitted. |
| Creator | Replaced with Traceglass metadata. |
| Arbitrary extensions and nested fields | Omitted, except numeric response `_transferSize`. |

A domain can identify an internal service. A path may include a signed token, email address, document ID or user name. A header name or allowlisted value can be abused to carry a secret. An attacker-controlled timestamp or size could itself be a side channel. This tool does not attempt to infer which retained metadata is confidential.

## Markdown and JSON

Markdown reports include a summary, findings, limitations, the ten slowest URLs and optional endpoint comparisons. Query values, credentials and fragments are hidden. Raw headers and bodies are absent. Untrusted text is escaped to avoid active Markdown links/images and injected table rows.

CLI JSON contains the reduced analysis model, including selected response metadata (`mime`, `cacheControl`, `protocol`) and page reference IDs. Treat these and filenames as potentially sensitive. For exchanging a capture, prefer reviewing the reconstructed sanitized HAR rather than assuming every analysis field is safe.

## Git

`.har` files are ignored except the two fixtures under `examples/`. This is an accidental-commit guard, not a scanner. Git ignore does not protect files already tracked or explicitly force-added.
