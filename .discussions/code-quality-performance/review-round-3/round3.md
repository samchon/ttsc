# Review Round 3 - Round 3

Lead: Final proposal pass. Submit concrete changes only; no broad rewrites.

Agent A: Apply best-effort cleanup in `runTtsx` and add an LSP hard-error drain
test. Clarify execute docs for `--cache-dir`.

Agent B: Extend `lookupSource` to probe `.js`, `.jsx`, `.mjs`, and `.cjs` after
TypeScript source extensions. Add one allowJs lookup test and strengthen the
ambiguous-stem priority test.

Agent C: Update no-loss-of-precision comments, add the huge-decimal guard and
test, simplify wasm temp-file cleanup, and update MemFS copy docs/comments.

Agent D: Fix the TS feature doc-comment headline and soften the banner
generated-source test to assert ordering rather than exact generated code.

Agent E: Update stale paths docs and add driver API, wasm, and `AGENTS.md`
documentation updates. Include the stale references outside paths.mdx.

Agent F: Apply `prepareExecution` post-build cleanup on failure. No architecture
or package-boundary change is required.
