# Security policy

Traceglass processes potentially sensitive and untrusted HAR files. Sanitized output is **not a guarantee that all secrets are removed**. URL paths, domains, query names, header names, timestamps and allowlisted metadata remain. See [the export policy](docs/PRIVACY.md).

## Reporting a vulnerability

Use the repository’s **Security → Advisories → Report a vulnerability** option when private reporting is available. If it is unavailable, open a minimal issue asking for a private contact route; do not disclose exploit details, live tokens, production captures or personal data in a public issue.

Include the affected version, a synthetic reproduction, expected behavior and the potential impact. Do not send real credentials as proof. No response-time or bounty commitment is made.

## Boundaries

- Only the current source version is maintained.
- No capture content is intentionally sent off-device by the app.
- Browser extensions, the operating system, hosting infrastructure and the browser itself are outside Traceglass’s security boundary.
- The local server binds to loopback and serves only browser assets and shared library files. It is a development convenience, not a hardened public server.
- Traces are in memory until reload/process exit. This is not secure erasure.
