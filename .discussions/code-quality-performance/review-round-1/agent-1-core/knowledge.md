# Agent 1 Core Notes

Scope: `packages/ttsc/src/compiler`, `packages/ttsc/src/plugin`, and
`packages/ttsc/src/launcher` excluding LSP/runtime changes. No source edits.

## Notes

- `packages/ttsc/src/launcher/internal/runTtsx.ts`: `withResolvableExtension`
  checked known JS extensions before splitting `?query` / `#hash`. A specifier
  like `./helper.js?query` already points at a JS file but could still be
  rewritten as `./helper.js?query.js`, changing `import.meta.url` and module
  identity.
- `packages/ttsc/src/compiler/internal/transformProjectInMemory.ts`: plugin
  backed transform spawns called `nativePluginEnv()`, and that helper resolved
  tsgo on every plugin invocation. `runBuild` already resolves tsgo once in its
  execution context.
- `packages/ttsc/src/launcher/internal/getCompilerVersionText.ts`: version
  output spawned tsgo directly, while normal build paths go through
  `spawnNative()`, which handles POSIX executable bits and script paths.
- `packages/ttsc/src/plugin/internal/buildSourcePlugin.ts`: cache-key
  computation hashes toolchain identity, Go env, source trees, overlays, and
  GOROOT identity. This is expensive, but cache-key correctness is part of the
  product contract.
- `packages/ttsc/src/plugin/internal/loadProjectPlugins.ts`: a pre-build
  transform-host compatibility gate would duplicate cache-key-derived binary
  compatibility logic.

## Proposals

1. Fix query/hash-aware ESM rewrite in `runTtsx.ts`.
   - Risk: low.
   - Validation: `pnpm --dir tests/test-ttsc start -- --include=test_ttsx_esm_rewrite_preserves_query_and_hash_on_extensioned_specifiers`.

2. Resolve tsgo once in the `transformProjectInMemory` native plugin path and
   pass the binary into env construction.
   - Risk: low if `process.env` and `options.env` precedence stays unchanged.
   - Validation: `pnpm --dir tests/test-ttsc start -- --include=test_ttsccompiler_transform_applies_configured_source_plugins_to_typescript_output`.

3. Route `getCompilerVersionText()` through the same spawn helper as build
   paths.
   - Risk: low.
   - Validation: `pnpm --dir tests/test-ttsc start -- --include=test_ttsc_reports_the_consumer_tsgo_version_banner`.

## Not Applied

- Broad Go/toolchain identity memoization risks stale cache keys if the selected
  toolchain or env mutates during a long process.
- A separate transform-host preflight risks rejecting valid same-binary cases or
  duplicating sensitive cache logic.
