# Contributing to Traceglass

Thanks for helping make network debugging clearer.

1. Open an issue describing the problem and a small reproducible example. For a straightforward bug fix, a focused pull request is welcome directly.
2. Use Node.js 22+. There are no dependencies to install. Run `npm start` for the workspace.
3. Keep shared analysis in `lib/`, UI behavior in `web/`, and platform-specific IO in `bin/` or `scripts/`.
4. Add a meaningful regression test for parsing, comparison, export or CLI behavior changes. Use `node:test` and synthetic fixtures.
5. Run `npm test`, `npm run check` and `npm run build`. For UI changes, check narrow and wide screens, keyboard navigation, the demo and an invalid file.
6. Describe what changes and why, plus the validation you performed.

Never attach a production HAR without reviewing its content. Do not commit cookies, tokens, private URLs or real response bodies. The example captures are intentionally synthetic. Do not loosen the sanitizer allowlist without documenting the disclosure implications.

Please keep discussions constructive and focused on the code. Small contributions—better messages, a parsing edge case, an accessible control—are valuable. Adding a framework or dependency requires a clear benefit that outweighs the maintenance cost.
