# Agent D Knowledge

Scope: website docs, package README, AGENTS, and script comments.

Findings:

- The paths walkthrough declaration example still used extensionless imports.
- The paths walkthrough `rewrite` snippet did not match the current source's
  ignored `filepath.Rel` error.
- `ttsx` docs omitted `.tsx` in `allowImportingTsExtensions`.
- Architecture docs blurred `TTSC_CACHE_DIR` and `ttsx --cache-dir` runtime
  output behavior.
- WASM docs used "source map" for a source-file map and under-described
  same-worker multi-wasm isolation.

Proposal: align docs wording and examples with current source behavior.
