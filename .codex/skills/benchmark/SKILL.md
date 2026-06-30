---
name: benchmark
description: Benchmark runner, fixture repos, and publication. Read before running, modifying, or publishing benchmark results.
---

# Benchmark

## What it measures

`ttsc + @ttsc/lint + ttsc format` versus the legacy `tsc + eslint + prettier` toolchain, on seven real-world TypeScript projects. `experimental/benchmark/performance.mjs` clones each fixture's three branches into `experimental/benchmark/.work/`, replays each cell `RUNS` times, and writes the medians to `website/public/benchmark/performance.json` for the public dashboard at https://ttsc.dev/benchmark.

`experimental/benchmark/graph.mjs` is a separate AI-token benchmark for `@ttsc/graph` and graph-MCP comparators. It reuses the same fixture clones and setup path, runs projects sequentially, fixes reasoning effort to `high`, and upserts its own cells into `website/public/benchmark/graph.json`. The `codegraph` arm runs `codegraph init` before the agent cells, records that setup as `toolSetupMs`, local-ignores `.codegraph/`, and removes the index unless `--keep-codegraph-index` is passed. The `codebase-memory` arm runs `codebase-memory-mcp cli index_repository` with an isolated `CBM_CACHE_DIR`, records that setup as `toolSetupMs`, local-ignores `.codebase-memory/`, and removes the cache unless `--keep-codebase-memory-index` is passed. The `serena` arm starts Serena's stdio MCP server through `uvx` by default, local-ignores `.serena/`, and removes the project metadata unless `--keep-serena-project` is passed.

Cell ID = `project:branch:op:threading`.

| Axis | Values |
| --- | --- |
| Project | `vue`, `rxjs`, `typeorm`, `zod`, `nestjs`, `vscode`, `shopping-backend` |
| Branch | `legacy`, `ttsc`, `ttsc-lint` |
| Op | `build`, `noEmit`, `eslint` (legacy only), `format` |
| Threading | `single`, `checkers2`, `checkers4`, `checkers8` (`format` keeps `single` + default `multi`) |

Methodology, per-axis interpretation, and dashboard tabs are documented in `website/src/content/docs/benchmark/performance.mdx`. Flags and env vars are tabled in `experimental/benchmark/README.md`. This skill covers the higher-level rules that those references assume.

## Running

```bash
node experimental/benchmark/performance.mjs                              # full matrix sweep
node experimental/benchmark/performance.mjs --project=vue --no-website   # one fixture, do not touch dashboard
node experimental/benchmark/performance.mjs --verify-only                # one pass per cell, no timing
node experimental/benchmark/performance.mjs --list                       # print resolved grid
node experimental/benchmark/performance.mjs --sequential                 # clone, measure, delete one fixture at a time (low-disk)
node experimental/benchmark/graph.mjs --project=typeorm --models=gpt-5.4-mini --tools=ttsc-graph,codegraph,codebase-memory,serena # one graph AI-token fixture
node experimental/benchmark/graph.mjs --all --models=gpt-5.4-mini --arm=baseline --tools=baseline --prompt-family=all --runs=5 --reset # baseline-only publication refresh
node experimental/benchmark/graph/audit-codex-traces.mjs --dir=experimental/benchmark/.work/graph/<timestamp> # inspect Codex messages/tools/reasoning tokens and baseline savings
node experimental/benchmark/graph/audit-codex-traces.mjs --compare=<before>,<after> # compare smoke-run audit/report dirs during optimization
node experimental/benchmark/graph/audit-codex-traces.mjs --self-test # regression-check audit parsing and savings semantics
```

Option families:

- **Scope**: `--project`, `--cell-filter`, `--lint-only`, `--format-only`, `--ttsc-build-only`. Every targeted run pairs with `--no-website` so the dashboard stays consistent.
- **Setup**: `--setup-only`, `--no-setup`, `--no-install`, `--no-pack` (or `TTSC_BENCH_SKIP_PACK=1`), `--force-install`. Setup packs the local `ttsc` workspace into tarballs, clones the fixtures, installs the tarballs, and runs `ttsc prepare` so plugin binaries are warm before any measured cell.
- **Sampling**: `TTSC_BENCH_RUNS` (5), `TTSC_BENCH_WARMUP` (1), `TTSC_BENCH_RETRIES` (2, applied only to `race`-classified failures). The reported number is the median; `min` and the full sample list stay in `report.json` for audit.
- **Host gate**: `TTSC_BENCH_REQUIRE_QUIET=1` upgrades the load-average warning into a hard error and is set for every publication run; `TTSC_BENCH_SKIP_LOAD_CHECK=1` silences it for development iterations.
- **Output**: `--no-website` skips merging into `website/public/benchmark/performance.json`; `--reset` discards prior measurements instead of merging in place; `TTSC_BENCH_OUT` redirects the local report; `--verbose` tees child stdio with `[cmd]` / `[step]` / `[timer]` traces (default is milestone-only).
- **Graph arms**: `graph.mjs --arm=baseline --tools=baseline` records only the empty-MCP baseline. Later `--arm=graph --tools=ttsc-graph,codegraph,codebase-memory,serena` runs add comparator samples against those website baseline cells. Prompt families are `dedicated` and `common`; `project-specific` and `shared-onboarding` remain accepted aliases. Graph-arm fallback to shell source reads/searches is a real measured outcome, not an invalid result; keep it visible through `shell`, `sourceTouches`, `graph`, and `attempts`. Exclude only zero-token infrastructure/capacity failures from published medians.
- **Graph publication**: parallel graph sweeps must run with `--no-website` and unique `--out` directories, then publish afterward with `node experimental/benchmark/graph/publish.mjs --from <out-dir>` for each completed suite. Direct concurrent writes to `website/public/benchmark/graph.json` can race.
- **VS Code graph lane**: `vscode` graph benchmark runs are globally single-lane. Do not run two `vscode` graph cells at the same time, even if the tool, model, or prompt family differs. Other projects may run in parallel while one `vscode` cell runs.
- **Graph sampling**: publication-grade cells use N=5 and report medians. N=1 is for smoke tests and repeated optimization loops; it may still be recorded to the website JSON when explicitly requested, with `runs: 1` preserved so it is not confused with a publication median.
- **Graph retries**: publication keeps the default `--max-run-retries=4` so transient agent failures do not thin the median. N=1 optimization smoke runs may use `--max-run-retries=0` when the point is to expose a failure mode without spending tokens on repeated attempts.
- **Codex trace audit**: `graph.mjs` automatically writes `codex-trace-audit.json` beside the suite report whenever it runs Codex cells; run `audit-codex-traces.mjs` directly only to re-audit an existing run. The audit records every exposed assistant message, every shell/MCP call in timeline order, per-turn usage, and `reasoning_output_tokens`; hidden reasoning text is not emitted by Codex and must not be invented. It separates strict exact avoidable output such as duplicate MCP calls and legacy inline evidence text, measured graph-replaceable shell-output surface, candidate MCP overfetch surfaces such as broad graph traces, later-turn prompt replay exposure where Codex exposes multiple `turn.completed` events, zero-MCP or shell-fallback graph-arm traces, and an input ledger that compares usage input tokens with visible trace material. The ledger's unexplained input is an accounting gap, not proof of one hidden category. It reports observed, replacement lower-bound, candidate-ceiling, and observed replay-adjusted savings against the matching N=5 website baseline medians. Use `--compare=<before>,<after>` on audit JSON files, suite reports, or suite directories to compare optimization smoke runs by the same token/reasoning/tool/savings fields. Pass `--baseline=none` to disable baseline comparison.
- **PR result comment**: every benchmark result table reported in chat or committed to the website must also be recorded on the active PR. Maintain one sticky comment, not a new comment per run. Start it with `<!-- ttsc-benchmark-results -->`, include the latest table, the report/audit paths, and known invalid/missing cells, and update that same comment whenever a newer measurement supersedes it. If no PR exists yet, keep the table in the final report and mark the PR comment as pending; post/update it immediately after the PR exists.
- **Disk-cheap mode**: `--sequential` (env `TTSC_BENCH_SEQUENTIAL=1`) holds only one `(project, branch)` clone in `.work/` at a time: clone, measure, delete, next. Incompatible with `--setup-only` / `--no-setup`.
- **Publication host**: run publication sweeps on a quiet external host, then commit the resulting `website/public/benchmark/performance.json`. `merge-website.mjs` remains available when merging partial `report.json` files by cell id.

Publication sweep:

```bash
TTSC_BENCH_REQUIRE_QUIET=1 node experimental/benchmark/performance.mjs
```

After the sweep, inspect the diff against `website/public/benchmark/performance.json`: every fixture row present, row order preserved, host panel reflects the machine that produced the numbers.

## Fixture repositories

Each fixture is a forked GitHub repo at `samchon/ttsc-benchmark-<name>`, plus `samchon/shopping-backend` for the plugin-heavy case. Every fixture carries three independent branches:

- **`legacy`**: upstream source with stock `tsc`, `eslint`, and `prettier`. TypeScript pinned to the Legacy TypeScript version shown on the dashboard host panel (currently `v6.0.3`).
- **`ttsc`**: same source as `legacy`, with `tsc` swapped for `ttsc` on the pinned TypeScript-Go `typescript@rc` runtime and the workspace configured to install `ttsc` from the tarball the runner packs.
- **`ttsc-lint`**: same source as `ttsc`, with `@ttsc/lint` folded into the compile pass so the `eslint` step is no longer invoked.

### Source parity

The three branches differ only in tooling, `package.json`, `tsconfig*.json`, `eslint.config.*`, `.prettierrc*`, lockfile, `ttsc` plugin descriptors. Application source is identical across `legacy`, `ttsc`, and `ttsc-lint`, so a cell delta reflects tool cost rather than workload drift.

### Lint and format scope is the tsconfig program

Across `legacy` and `ttsc-lint`, the lint and format cells process exactly the file set `tsconfig.json` compiles for that fixture. `eslint` and `@ttsc/lint` lint that set; `prettier --check` and `ttsc format` format that set.

Nothing inside the program is excluded; nothing outside it is targeted. Carve-outs via `--ignore-pattern`, `eslint.config` `ignores`, `.prettierignore`, or extra `files`/`exclude` entries are rejected because they make the cells incomparable.

### Editing workflow

Edits go to the fixture repo on GitHub, not to the local clone. Setup runs `fetch + reset --hard` to the upstream branch tip on every run, so local changes in `.work/` disappear immediately.

Finish every fixture-branch edit by running the branch's own build, format, and lint commands (e.g. `pnpm build`, `prettier --write` or `ttsc format`, `eslint --fix`) until the tree is green, then commit and push. A half-finished tip pollutes every later run because the runner pulls upstream every setup.

READMEs and prose docs inside a fixture repo follow the same writing rules as ttsc itself. See AGENTS.md `## Maintenance 짠 Writing style` and `.codex/skills/documentation/SKILL.md 짠 READMEs`.

### Other rules

- **No tarball or built artifact in the fixture.** The runner packs and installs the local `ttsc` workspace during setup. The fixture repo must not carry pre-baked tarball paths, vendored `ttsc` builds, or stale `dist/` output.
- **Pin major TypeScript in lockstep.** When the Legacy TypeScript headline version bumps, update every fixture's `legacy` branch in the same release so the `tsc` baseline stays one major across the matrix.
- **Add fixtures by adding repos.** A new fixture means a new `samchon/ttsc-benchmark-<name>` repo carrying all three branches, plus a `PACKAGE_CONFIGS` entry at the top of `performance.mjs`. Multi-fixture tricks inside one repo are out of scope.
- **Removed comparisons stay removed.** The `type-fest` fixture was dropped deliberately. The `tsgo` rows (raw TypeScript-Go measured on the same `ttsc` clone for `build`/`noEmit`, cell ID `project:ttsc:tsgo:op:threading`) are a kept reference for launcher overhead, not eligible for the headline winner.
