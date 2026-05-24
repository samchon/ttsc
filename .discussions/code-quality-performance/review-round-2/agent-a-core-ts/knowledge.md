# Agent A Core TS Notes

Scope: current working-tree diff plus `runTtsx.ts`, `prepareExecution.ts`,
`getCompilerVersionText.ts`, `transformProjectInMemory.ts`, and related
`tests/test-ttsc` feature cases. No source edits.

## Findings

1. Accept: `ttsx` docs still described persistent compiled-JS caching after
   runtime output cleanup. Update `website/src/content/docs/ttsc/execute.mdx`
   to distinguish temporary runtime emit from persistent source-plugin cache.

2. Accept: `runPreparedEntry` cleanup started after ESM rewrite and package
   marker writes. Wrap emit-dir preparation, ESM rewrite, marker write, and
   child spawn in one `try/finally`.

3. Accept: add a test proving `ttsc --version` repairs a non-executable
   consumer-local `tsgo` before spawning through `spawnNative`.

## Non-Findings

- `transformProjectInMemory.ts` resolving tsgo once per plugin-backed transform
  path is reasonable and preserves the env override shape.
- The query/hash ESM rewrite fix is correct.
