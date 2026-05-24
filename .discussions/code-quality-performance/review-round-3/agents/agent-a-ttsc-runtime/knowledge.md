# Agent A Knowledge Base - ttsc Runtime/LSP/ttsx

Scope read: changed `packages/ttsc/src/launcher/internal/{prepareExecution,runTtsx}.ts`,
`packages/ttsc/internal/lspserver/*`, driver LSP exports, LSP tests, and
`website/src/content/docs/ttsc/execute.mdx`.

Findings:

- Code quality improved in the main runtime paths. `prepareExecution` now
  carries an explicit `cleanupDir`, and `runTtsx` removes only the per-process
  runtime output instead of touching configured `outDir`.
- LSP framing now has size caps for both body and header data. That is a real
  robustness improvement, not a benchmark-only micro-optimization.
- No tests were removed or weakened in this area.
- One remaining risk was cleanup error precedence: `runPreparedEntry` used
  `fs.rmSync` in `finally`, so a cleanup failure could replace the user's child
  process exit status. Cleanup should be best-effort.
- Another remaining risk was LSP pump draining: existing tests pre-closed the
  sibling stream to let `Proxy.Run` return after a hard write failure. The proxy
  now has `closeAfterPumpError`; a focused test should prove that method does
  the draining itself.

Proposals:

- Make `runTtsx` cleanup best-effort so cleanup failure cannot hide child exit
  status.
- Add a focused LSP test where one pump hard-fails and the opposite stream is
  not pre-closed.
- Clarify `ttsx --cache-dir` docs: it anchors temporary runtime output and
  source-plugin binary cache, while runtime project output is still cleaned per
  run.
