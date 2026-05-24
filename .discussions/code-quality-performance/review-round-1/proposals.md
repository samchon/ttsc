# Research Review Round 1 Proposals

## Agent 1: Core Compiler and Launcher

1. Preserve query/hash suffixes when `ttsx` rewrites ESM specifiers that already
   include a JS extension.
2. Resolve tsgo once for `TtscCompiler.transform()` native plugin execution
   instead of once per plugin spawn.
3. Route `ttsc --version` through the same native spawn helper used by build
   paths.
4. Do not memoize broad Go/toolchain identity hashes or add a transform-host
   preflight gate in this round.

## Agent 2: LSP and Runtime

1. Skip empty JSON-RPC id keys in LSP code-action bookkeeping.
2. Make `Proxy.Run` tear down the opposite pump after the first hard transport
   error.
3. Add a maximum LSP header size.
4. Clean successful `ttsx` PID-scoped project emit directories after the child
   process exits.
5. Defer broad source-plugin identity memoization and unknown-field-preserving
   LSP augmentation.

## Agent 3: Lint

1. Fix `no-loss-of-precision` so the first unsafe integer, `9007199254740992`,
   is reported.
2. Review fix-file permission preservation.
3. Defer medium-risk lint performance refactors: inline-disable single-pass,
   glob precompilation, format rule-name caching, comment-span scanning, and
   per-file `consistent-type-imports` usage classification.

## Agent 4: Utility Plugins, Unplugin, Wasm

1. Harden banner config loaders with a timeout and Windows junction fallback.
2. Make banner JS/CJS default-export unwrapping match strip and TS config
   loaders.
3. Make paths source-stem resolution deterministic when multiple source files
   share a basename.
4. Serialize wasm stdout/stderr capture.
5. Complete MemFS errno mappings and copy caller-owned `Uint8Array` writes.
6. Defer unplugin cache-hit mtime/size optimization because invalidation
   correctness needs a dedicated pass.

## Agent 5: Tests and Scripts

1. Add root `test:go` and include existing Go runners in `pnpm test`.
2. Add `-count=1` to non-coverage Go test runners.
3. Preserve `options.env` in `tests/test-ttsc/src/internal/toolchain.ts` spawn
   wrappers.
4. Defer utility-helper extraction and `build-current` scheduling changes.

## Agent 6: Website, Playground, VSCode

1. Record playground lint-toggle, typia output/diagnostic, wasm cache-key,
   Monaco extra-lib, VSCode typecheck, and stale-doc proposals for a focused
   frontend/docs round.
2. Defer these from round 1 because they touch different user-facing surfaces
   and need UI/docs-specific validation.
