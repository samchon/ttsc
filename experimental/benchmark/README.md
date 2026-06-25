# ttsc benchmark runner

Clone-based, reproducible matrix benchmark of the `ttsc` toolchain against stock `tsc`, `eslint`, and `prettier` across real-world TypeScript projects.

This README is the runner reference. For the published numbers and result interpretation. Build vs type-check vs lint vs format comparisons, the multi-threaded vs single-threaded analysis, and per-fixture commentary. See https://ttsc.dev/benchmark (source: `website/src/content/docs/benchmark/performance.mdx`).

## Quickstart

Prereq: `pnpm install` at the workspace root so the local `ttsc` workspace can be built and packed into tarballs.

```bash
node performance.mjs                          # full sweep
node performance.mjs --project=vue            # one fixture
node performance.mjs --setup-only             # clone + install, no measurement
node performance.mjs --list                   # print the cell grid and exit
node performance.mjs --verbose                # tee child stdio for debugging
node graph.mjs --project=typeorm --tools=ttsc-graph,codegraph # one graph AI-token benchmark
node graph.mjs --all --models=sonnet,opus,codex --tools=ttsc-graph,codegraph # full graph AI-token sweep
```

The first run packs the local `ttsc` workspace into tarballs, clones each fixture's three branches into `.work/`, installs the tarballs, runs `ttsc prepare`, then measures the matrix sequentially. Subsequent runs reuse the clones.

`graph.mjs` reuses the same fixture clones and setup path where a performance fixture exists, but it is separate from `performance.mjs` because it spends AI tokens. Graph-only repos such as `excalidraw` are cloned directly into `.work/graph-source/` instead of being added to the performance matrix. It runs projects sequentially, fixes reasoning effort to `high`, updates only its own cells in `website/public/benchmark/graph.json`, and writes a local report under `.work/graph/<timestamp>/`. Its tool axis is `ttsc-graph` and `codegraph`; its prompt-family axis is `project-specific` and `shared-onboarding` (`--prompt-family=all` runs both). The `codegraph` arm runs `codegraph init`, records the index time as `toolSetupMs`, local-ignores `.codegraph/`, and deletes the index after the run unless `--keep-codegraph-index` is set.

## The matrix

A **cell** is one `(project, branch, tool, op, threading)` measurement.

- **Branches** (each fixture is a forked repo with all three):
  - `legacy`: stock `tsc` / `eslint` / `prettier`
  - `ttsc`: `ttsc` over the pinned TypeScript-Go `typescript@rc` runtime
  - `ttsc-lint`: `ttsc` with `@ttsc/lint` folded into the compile pass
- **Ops**: `build` (emit), `noEmit` (type-check only), `eslint` (legacy only), `format` (legacy `prettier --check` vs `ttsc format`).
- **Threading**: compiler and lint cells use `single` (`--singleThreaded`) plus `checkers2` / `checkers4` / `checkers8` (`--checkers N`). Legacy cells and `eslint` cells are `multi` only. Format keeps `single` plus the bare default `multi` row because `--checkers N` does not control formatter work.
- **Tool resolution** (set per cell, recorded in the report):
  - legacy: `tsc`, `eslint`, or `prettier` depending on op
  - ttsc: `ttsc`; raw TypeScript-Go is also measured as a parallel `tsgo` cell on the same clone so the ttsc launcher overhead is observable
  - ttsc-lint: `ttsc+@ttsc/lint` for build/noEmit, `ttsc-format` for format

Cell IDs follow `project:branch:op:threading`, with `:tsgo:` inserted before the op for raw TypeScript-Go cells (e.g. `vue:ttsc:tsgo:build:single`). Run `--list` to print the resolved grid for the selected fixtures.

## Fixtures

| Project | Repo | Kind | Package mgr |
| --- | --- | --- | --- |
| `vue` | `samchon/ttsc-benchmark-vue` | frontend monorepo | pnpm |
| `rxjs` | `samchon/ttsc-benchmark-rxjs` | library monorepo (cjs / esm / types per package) | yarn |
| `typeorm` | `samchon/ttsc-benchmark-typeorm` | ORM library | pnpm |
| `zod` | `samchon/ttsc-benchmark-zod` | schema library monorepo | pnpm |
| `nestjs` | `samchon/ttsc-benchmark-nestjs` | backend framework monorepo (9 packages per op) | npm |
| `vscode` | `samchon/ttsc-benchmark-vscode` | application monorepo | npm |
| `shopping-backend` | `samchon/shopping-backend` | plugin-heavy service (typia/nestia source plugins) | pnpm |

Per-project commands, install/prepare overrides, and prerequisites live in `PACKAGE_CONFIGS` at the top of `performance.mjs`.

## CLI flags

| Flag | Effect |
| --- | --- |
| `--project NAME` / `--project=A,B` | Limit to named fixtures. Stacks; positional names work too. |
| `--cell-filter REGEX` | Keep cells whose ID matches. Stacks. |
| `--ttsc-build-only`, `--only-ttsc-build` | `ttsc` branch, `build` op, non-`tsgo` cells only. |
| `--lint-only` | Only the lint comparison set (`legacy:noEmit`, `legacy:eslint`, `ttsc:noEmit`, `ttsc-lint:noEmit`). |
| `--format-only` | Only `format` cells. |
| `--setup-only` | Pack + clone + install + `ttsc prepare`. No measurement. |
| `--verify-only` | Run each selected cell once and fail loudly on any error. |
| `--sequential` | Clone, measure, and delete one `(project, branch)` at a time instead of holding all clones in `.work/` simultaneously. Disk-cheap mode for GitHub Actions and other space-constrained CI. Mutually exclusive with `--setup-only` / `--no-setup`. Env: `TTSC_BENCH_SEQUENTIAL=1`. |
| `--pack-only` | Build and pack the local ttsc / @ttsc/lint / platform tarballs into `TTSC_BENCH_TGZ` and exit. No clones, no measurements. Used by the CI `pack` job to seed a shared artifact that the matrix `measure` jobs consume with `--no-pack`. |
| `--no-setup` | Skip pack/clone/install; measure the existing clones. |
| `--no-install` | Skip the install step inside setup. |
| `--no-pack` | Reuse tarballs already in `TTSC_BENCH_TGZ` (same as `TTSC_BENCH_SKIP_PACK=1`). |
| `--force-install` | Reinstall even when `node_modules` is already present. |
| `--allow-missing` | Tolerate fixtures whose clones failed setup instead of aborting. |
| `--reset` | Discard the previous report; do not merge with prior measurements. |
| `--no-website` | Do not publish into `website/public/benchmark/performance.json`. |
| `--verbose` | Tee child stdio (install / pack / build) live and add `[cmd]` / `[step]` / `[timer] start` traces. Default output is milestone-only; use this when an AI/agent run needs the full transcript for diagnosis. |
| `--list` | Print the per-fixture cell grid and exit. |

Graph-only flags:

| Flag | Effect |
| --- | --- |
| `--models sonnet,opus,codex` | Select agent models for `graph.mjs`. `codex` resolves to `--codex-model` and always uses effort `high`. |
| `--tools ttsc-graph,codegraph` | Select graph tools for `graph.mjs`. Use `all` for both. |
| `--branch ttsc` / `--fixture-branch ttsc` | Select the fixture branch for `graph.mjs`; allowed values are `ttsc` and `ttsc-lint`. |
| `--daemon=1` | Use the `ttscgraph` daemon for `@ttsc/graph` cells. `codegraph` manages its own index and does not use this path. |
| `--no-codegraph-index` | Reuse an existing `.codegraph/` index instead of running `codegraph init`. |
| `--keep-codegraph-index` | Keep `.codegraph/` after the run for inspection or reuse. |

## Environment overrides

| Variable | Default | Meaning |
| --- | --- | --- |
| `TTSC_BENCH_WORK` | `./.work` | Clone working directory. |
| `TTSC_BENCH_TGZ` | `/tmp/ttsc-tgz-<pid>` (`/tmp/ttsc-tgz` with `--no-pack`) | Tarball staging directory. |
| `TTSC_BENCH_OUT` | `./.work/report.md` | Report destination; sibling `.json` is written alongside. |
| `TTSC_BENCH_CHECKPOINT` | `<WORK>/benchmark.checkpoint.json` | Intermediate snapshot rewritten after each cell so an interrupted run is resumable. |
| `TTSC_BENCH_RUNS` | `5` | Measured runs per cell. |
| `TTSC_BENCH_WARMUP` | `1` | Warmup runs per cell (excluded from the median). |
| `TTSC_BENCH_RETRIES` | `2` | Retries allowed for a `race`-classified failure. |
| `TTSC_BENCH_SKIP_PACK` | - | `1` reuses tarballs in `TTSC_BENCH_TGZ` (same as `--no-pack`). |
| `TTSC_BENCH_REQUIRE_QUIET` | - | `1` turns the host-load warning into a hard error. |
| `TTSC_BENCH_SKIP_LOAD_CHECK` | - | `1` disables the host-load check entirely. |

## Method

- Each cell runs `WARMUP` unmeasured passes (absorbs cold filesystem cache and Go runtime warmup) then `RUNS` measured passes. The **median** is the reported time; `min` and the full sample list are kept in JSON.
- `ttsc-lint` build/check cells add `--diagnostics` and parse `@ttsc/lint time`, `ttsc check plugin @ttsc/lint time`, and any `ttsc transform host [...] time` lines from stdout. The dashboard uses the native `@ttsc/lint` timing as the green lint segment; the sidecar total is retained for audit because it also includes TypeScript-Go Program and diagnostics work that belongs in the compiler segment.
- Plugin binaries are built by `ttsc prepare` during setup, never during a measured run, so compiler timings do not include plugin build time.
- Non-zero exits are classified from captured output. A `race` (TypeScript-Go data-race markers, `concurrent map`, `fatal error`, `panic:`, `DATA RACE`) is retried up to `RETRIES` times and the clean timing kept; a deterministic `error` is recorded as failed without retry.
- Cells are measured **sequentially** so they do not compete for CPU.
- `--sequential` is a separate, disk-cheap top-level mode: instead of cloning all fixtures up front, it clones one `(project, branch)`, measures its cells, deletes the clone, and moves to the next. The tarball pack runs once at the start. Per-project metadata (file count, legacy `typescript` version, host spec) is captured while each clone exists and reused for the final report. The published `website/public/benchmark/performance.json` is merged in place after every cycle, so an interrupted sequential run leaves a resumable snapshot just like batch mode. Verify-only runs skip the per-cycle website write to avoid noisy host-metadata-only commits.
- Publication sweeps run on an external quiet host, not in the repository's GitHub Actions workflows. `merge-website.mjs` can still fold partial `report.json` files into `website/public/benchmark/performance.json` by id: missing partials keep their previous cells intact, fresh partials replace by id, and only the freshest partial that _carries measurements_ rotates the top-level `date` / `host` block.
- At startup the runner checks `loadavg[0] / cpus()` and warns when the ratio exceeds 0.5, the fastest cells (`ttsc:build:single`, ~2–8 s) drift 20–60 % on a busy host. Override with `TTSC_BENCH_REQUIRE_QUIET=1` to error instead, or `TTSC_BENCH_SKIP_LOAD_CHECK=1` to silence.

## Output

| File | Contents |
| --- | --- |
| `.work/report.md` | Per-project Markdown table (`Branch \| Op \| Threading \| Median \| Samples \| Failure`) preceded by a `Host` block (OS, kernel, CPU, RAM, `node` / `ttsc` / `typescript` / `tsgo` versions). |
| `.work/report.json` | Same content plus per-sample timings, retry counts, and exit statuses. |
| `.work/benchmark.checkpoint.json` | Same shape as `report.json`, rewritten after every cell so a Ctrl-C run leaves a resumable snapshot. |
| `website/public/benchmark/performance.json` | Dashboard view consumed by https://ttsc.dev/benchmark. Merged in place, cells not re-measured in this run keep their previous values. Skip with `--no-website`, wipe and replace with `--reset`. |
| `website/public/benchmark/graph.json` | Graph dashboard data. `graph.mjs` upserts only measured cells by harness, tool, repo, model, effort, fixture branch, and daemon mode. |

`.work/` is git-ignored; results are an ephemeral artifact and never committed.
