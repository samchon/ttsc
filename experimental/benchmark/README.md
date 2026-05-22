# ttsc matrix benchmark

A clone-based, reproducible benchmark of the `ttsc` toolchain against the stock
TypeScript toolchain, run as a **matrix** over many real-world TypeScript
projects.

`bench.mjs` clones each fixture project's forked repo, installs the locally
built `ttsc` / `@ttsc/lint` tarballs, and measures wall-clock build time across
a grid of toolchain configurations. Nothing is hand-prepared — a run is
reproducible from a clean checkout.

## The matrix

Every fixture is a forked repo with three branches:

| Branch | Toolchain |
| --- | --- |
| `legacy` | stock `tsc` (TypeScript 5.x) · `prettier` · `eslint` |
| `ttsc` | `ttsc` (TypeScript 7 via `@typescript/native-preview`) |
| `ttsc-lint` | `ttsc` + `@ttsc/lint` (linting folded into the compile pass) |

Each `(project × branch)` is measured along two more dimensions:

| Dimension | Values |
| --- | --- |
| Emit | **emit build** (type-check + emit) · **`--noEmit`** (type-check only) |
| Threading | **multi-threaded** (ttsc default) · **single-threaded** (`--singleThreaded`) |

The `legacy` branch is measured multi-threaded only — stock `tsc` has no
`--singleThreaded`. The `ttsc` / `ttsc-lint` branches are measured both ways.

The report has three sections:

- **M1 — Emit build**: `tsc` vs `ttsc` vs `ttsc + @ttsc/lint`. Reports the
  `tsc → ttsc` speedup and the *lint cost* (`ttsc-lint` over plain `ttsc` — the
  marginal cost of folding linting into the compile pass).
- **M2 — Type-check only**: the same input under `--noEmit`, isolating checker
  speed from emit cost.
- **M3 — Threading**: single-threaded vs multi-threaded `ttsc`.

## Fixtures

| Project | Repo | Kind | Measured command | Notes |
| --- | --- | --- | --- | --- |
| `shopping-backend` | `samchon/shopping-backend` | plugin-heavy | `tsc` / `ttsc` (build:main) | nestia/typia source plugins on every file; needs `build:prisma` + `build:sdk` first |
| `tstl` | `samchon/tstl` | plugin-free | `tsc` / `ttsc` | STL/algorithms library; small anchor |
| `zod` | `samchon/ttsc-benchmark-zod` | plugin-free | `tsc -p tsconfig.benchmark.json` | schema-validation library; built from `packages/zod` |
| `rxjs` | `samchon/ttsc-benchmark-rxjs` | plugin-free | `tsc -p tsconfig.bench.json` | reactive-streams library; yarn/nx monorepo, built from `packages/rxjs` |
| `type-fest` | `samchon/ttsc-benchmark-type-fest` | plugin-free | `tsc` (`noEmit`) | pure type-level library — type-check only, no emit cell |
| `vue` | `samchon/ttsc-benchmark-vue` | plugin-free | `tsc --noEmit` | frontend framework; type-check only (`ttsc-lint` branch TBD) |
| `nestjs` | `samchon/ttsc-benchmark-nestjs` | plugin-free | `tsc -b packages` / `build-ttsc.mjs` | project-references monorepo; emit build only (the orchestrator exposes no `--noEmit` / `--singleThreaded`) |

`samchon/ttsc-benchmark-vscode` is a planned fixture; its branches are not
pushed yet, so it is left as a `TODO` in `bench.mjs` and skipped at runtime.

The per-project build commands, prerequisites, and supported modes live in the
`PROJECTS` config table at the top of `bench.mjs`. Run `node bench.mjs --list`
to print it.

## Run

```bash
node bench.mjs                 # all fixtures: clone, install, measure
node bench.mjs tstl zod        # selected fixtures only
node bench.mjs --list          # print the config table and exit
node bench.mjs --setup-only    # clone + install, no measuring
node bench.mjs --no-setup      # measure only (reuse existing clones)
```

The first run builds and packs the local `ttsc` / `@ttsc/lint` /
current-platform tarballs into `/tmp/ttsc-tgz/`, clones every fixture branch
into `/tmp/ttsc-bench-work/`, installs each clone, runs `ttsc prepare` on the
`ttsc` / `ttsc-lint` clones, and runs each project's prerequisites — then
measures the matrix.

Clones live **outside** the repo tree: cloning inside `ttsc` would let pnpm
adopt the clone into the `ttsc` workspace. Each clone also gets a stray
`pnpm-workspace.yaml` so it stays an isolated workspace regardless of location.

A fork branch that is not pushed yet is skipped cleanly — the run does not
crash.

## Output

The report — a Markdown matrix plus a `.json` sidecar — is written to
`.work/` next to this script. `.work/` is **git-ignored**: benchmark results are
an ephemeral artifact and are never committed.

The report opens with a **Host** block recording OS name + kernel, CPU model +
core count, total RAM, and toolchain versions (node, `ttsc`,
`@typescript/native-preview`, `tsc`), so a number is always traceable to the
machine that produced it.

Results merge into the existing `.json`, so fixtures can be measured across
separate invocations and still report as one matrix.

## Method

Each matrix cell runs `WARMUP` unmeasured times (absorbs first-run plugin
compilation and cold filesystem cache), then `RUNS` measured times; the
**median** is reported. Single-threaded cells re-clean their output directory
before every run so each timing starts from the same state.

A measured run that exits non-zero is classified from its output: a `race`
failure (the intermittent TypeScript-Go data-race crash) is retried up to
`RETRIES` times and the clean timing kept; a deterministic `error` (a real
compile error) is not retried and the cell is left unmeasured. Both are
reported in a **Stability** section, keeping an orthogonal stability bug out of
the speed numbers.

## Environment overrides

| Variable | Default | Meaning |
| --- | --- | --- |
| `TTSC_BENCH_WORK` | `/tmp/ttsc-bench-work` | clone working directory |
| `TTSC_BENCH_TGZ` | `/tmp/ttsc-tgz` | tarball staging directory |
| `TTSC_BENCH_OUT` | `.work/report.md` | report destination (`.md` + `.json`) |
| `TTSC_BENCH_RUNS` | `3` | measured runs per cell |
| `TTSC_BENCH_WARMUP` | `1` | warmup runs per cell |
| `TTSC_BENCH_RETRIES` | `3` | retries to recover a crashed run |
| `TTSC_BENCH_SKIP_PACK` | — | set to `1` to reuse existing tarballs |
