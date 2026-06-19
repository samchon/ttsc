# @ttsc/unplugin per-module cost reproduction

This experiment drives the **real** `@ttsc/unplugin` Rollup plugin object over a synthetic project of `N` TypeScript files and measures, per simulated build:

- **plugin runs** — how many times the whole project is re-transformed (native plugin spawns). A correct per-build cache transforms the project **once**.
- **`fs.readFileSync` calls / bytes** — the file-system work the adapter performs while serving the `N` modules. A correct cache walks the tree a constant number of times; the current code re-hashes the entire project on every module.

The guarded invariant is **`plugin runs == 1`**: a build must transform the whole project exactly once and serve every other module from the per-build cache. The harness exits non-zero if any build exceeds one transform.

- **Scenario A — output keys under the project root.** The cache hits, so the project is transformed once. (`reads` still grow with `N`: validating a cache hit re-hashes the project to detect a sibling-file change — bounded work that the existing invalidation contract requires.)
- **Scenario B — one output key outside the validator's directory walk** (a `node_modules/**` path, exactly what the native host emits for program dependencies). Before the fix the store-time and validate-time hash key sets diverged, the cache _never_ hit, and the whole project was re-transformed once per module (`plugin runs == N`); now the cache hits and `plugin runs == 1`.

The adapter source is bundled on the fly with esbuild (with `ttsc` and `unplugin` kept external), so the production code path runs unmodified — no rebuilt `lib` required.

Run from the repository root:

```bash
pnpm --dir experimental/unplugin-perf start
```

Requires a built `ttsc` package (`packages/ttsc/lib`) and a Go toolchain on PATH (the synthetic transform plugin is a tiny Go sidecar).
