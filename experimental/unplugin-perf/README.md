# @ttsc/unplugin per-module cost reproduction

This experiment drives the **real** `@ttsc/unplugin` Rollup plugin object over a synthetic project of `N` TypeScript files and measures, per simulated build:

- **plugin runs** — how many times the whole project is re-transformed (native plugin spawns). A correct per-build cache transforms the project **once**.
- **`fs.readFileSync` calls / bytes** — the content work the adapter performs while serving the `N` modules. A correct cache validates only each module's derived inputs.
- **`fs.lstatSync` calls** — the metadata call every derived input's validation makes first, and after samchon/ttsc#1261 the only per-delivery filesystem work a serve session has left. Its size is the delivered file's derived input set, which is why a producer that declares [dependency completeness](https://ttsc.dev/docs/development/concepts/protocol#dependency-completeness) pays less of it (scenario F against scenario E).
- **`fs.statSync` calls** — synchronous validation work. Scenario D adds 100 unrelated nested directories and requires generation-scoped membership notification rather than one directory-stat pass per module.
- **fs identity probes:** the `existsSync`/`realpathSync.native` call volume paid by the shared path-identity resolver on the real host platform. Correct watch-input derivation pays it once per distinct graph path per generation, not once per module delivery.

The guarded invariants are **`plugin runs == 1`**, **`stats/file` within the membership budget** (a missing resolution candidate is proven by notification rather than re-probed, samchon/ttsc#1261), **`lstats/file` within the budget the scenario's own envelope justifies** (declared by the serve scenarios whose shape bounds it, D and F), and, for the graph scenario, **bounded probes per module** — the harness exits non-zero when any of them breaks.

- **Scenario A — output keys under the project root.** The cache hits, so the project is transformed once. (`reads` still grow with `N`: validating a cache hit re-hashes the project to detect a sibling-file change — bounded work that the existing invalidation contract requires.)
- **Scenario B — one output key outside the validator's directory walk** (a `node_modules/**` path, exactly what the native host emits for program dependencies). Before the fix the store-time and validate-time hash key sets diverged, the cache _never_ hit, and the whole project was re-transformed once per module (`plugin runs == N`); now the cache hits and `plugin runs == 1`.
- **Scenario C — a graph-bearing envelope (the typia >= 13.1.19 shape).** The sidecar stamps `graph` (every module edges to its next sibling plus `K` external `node_modules` declarations, and one missing resolution candidate) and per-file `dependencies`. Before the #1007 fix every cache-hit delivery re-walked the whole graph: probes per module grew linearly with the edge count (6.7k/12k/22.8k probes per module at E=2.6k/5.1k/10.1k, ~76-95 s for 99 deliveries), the O(modules x edges) syscall storm behind the #970 residual stall on macOS. The gate is 64 probes per module; the fixed code derives once per generation and stays flat regardless of `E`.
- **Scenario D: the same envelope without a build boundary** (the Vite development server's persistent-validation mode). Each module owns one disjoint external input, and the project contains 100 unrelated nested directories. The gates require reads to stay bounded by that file's inputs and synchronous stats not to grow with either the whole-envelope union or project directory count.
- **Scenario E — the same serve mode over a _shared_ closure.** Every module reaches the same externals and the same `graph.globals` (the shape a real program produces, where the globals are whatever `@types/*` packages declare). Scenario D's partition hides this: with a shared closure the pre-#1222 code re-read and re-hashed the whole closure for every delivered module, so reads/file grew with the closure instead of staying flat. The per-file read gate is the same one Scenario D uses, and it now holds only because an unchanged nanosecond metadata signature stands in for the content comparison. Its stat gate is its own: a missing resolution candidate cannot be proven absent by metadata, so each one reachable from the delivered file costs one failed `stat`, and a shared closure makes that set grow with the module count rather than staying flat.
- **Scenario F: the same serve shape from a producer that declares completeness.** The sidecar stamps `dependenciesComplete` for every file it reports, which is what `@ttsc/banner` and `@ttsc/strip` do today and what samchon/typia#2357 asks typia for. The delivered file's derived set collapses from the whole closure to the reported dependencies plus the config chain, which is the sound way to stop validating what a transform never consulted: measured on this fixture it is the difference between 127.5 and 54.0 `lstat` calls per delivery.

The adapter source is bundled on the fly with esbuild (with `ttsc` and `unplugin` kept external), so the production code path runs unmodified — no rebuilt `lib` required.

Run from the repository root:

```bash
pnpm --dir experimental/unplugin-perf start
```

Requires a built `ttsc` package (`packages/ttsc/lib`) and a Go toolchain on PATH (the synthetic transform plugin is a tiny Go sidecar).
