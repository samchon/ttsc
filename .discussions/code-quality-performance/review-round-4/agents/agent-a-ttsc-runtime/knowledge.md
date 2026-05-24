# Agent A Knowledge Base - ttsc Runtime/LSP/ttsx

Scope read: current uncommitted diff for `prepareExecution`, `runTtsx`, LSP
framing/proxy tests, `execute.mdx`, and driver API docs.

Findings:

- Code quality improved: `ttsx` runtime output cleanup is now best-effort in
  the normal execution path and the LSP proxy has direct hard-error drain
  coverage.
- Documentation improved for LSP framing exports and cache semantics.
- No test deletion, hardcoded consumer path, or over-optimization was found.

Proposal accepted:

- `execute.mdx` used `-r ./preload.ts`, but `ttsx` passes preloads directly to
  Node's raw `--require`. The example should use `.cjs`/`.js` or state that
  preloads are not compiled by `ttsx`.
- The failed-build cleanup path in `prepareExecution` still used direct
  `fs.rmSync`, so cleanup failure could mask the original project-check
  diagnostic. Reuse the best-effort helper.
