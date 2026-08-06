# Toolchain Performance Benchmark

Read this document before running or changing `benchmarks/performance/src/executable/index.ts`, editing its `legacy`, `ttsc`, or `ttsc-lint` fixture branches, or publishing `website/public/benchmark/performance.json`.

## Workload

The benchmark compares `ttsc + @ttsc/lint + ttsc format` with `tsc + eslint + prettier` on seven real TypeScript projects. The runner clones three branches per fixture into `benchmarks/performance/.work/`, warms the configured toolchain, replays each cell, and publishes raw samples for dashboard-side reduction at https://ttsc.dev/benchmark.

Cell ID is `project:branch:op:threading`.

| Axis | Values |
| --- | --- |
| Project | `vue`, `rxjs`, `typeorm`, `zod`, `nestjs`, `vscode`, `shopping-backend` |
| Branch | `legacy`, `ttsc`, `ttsc-lint` |
| Operation | `build`, `noEmit`, `eslint` (legacy only), `format` |
| Threading | `single`, `checkers2`, `checkers4`, `checkers8`; format uses `single` and default `multi` |

The detailed methodology and dashboard interpretation live in `website/src/content/docs/benchmark/performance.mdx`. The full flag and environment-variable table lives in `benchmarks/performance/README.md`.

## Fixture Contract

Each fixture is `samchon/ttsc-benchmark-<name>`, except the plugin-heavy `samchon/shopping-backend`.

- **`legacy`:** upstream source using stock `tsc`, ESLint, and Prettier. Pin TypeScript to the dashboard's Legacy TypeScript major.
- **`ttsc`:** the same source using the pinned TypeScript-Go runtime and workspace-packed ttsc.
- **`ttsc-lint`:** the same source as `ttsc`, with `@ttsc/lint` folded into compilation instead of a separate ESLint step.

Application source must remain identical across the three branches. Tooling files may differ: `package.json`, lockfiles, `tsconfig*.json`, ESLint and Prettier configuration, and ttsc plugin descriptors.

Lint and format cells process exactly the program selected by `tsconfig.json`. Do not exclude files through ignore patterns or add out-of-program files; either change makes the cells incomparable.

When the Legacy TypeScript headline major changes, update every fixture's `legacy` branch in the same release. Add a fixture by adding a repository with all three branches and a project entry in `benchmarks/performance/src/TtscBenchmarkPerformanceConfiguration.ts`; do not multiplex unrelated fixtures inside one repository.

`type-fest` remains deliberately removed. Raw `tsgo` rows remain a launcher-overhead reference and are not eligible for the headline winner.

## Run Locally

```bash
pnpm --dir benchmarks/performance run start
pnpm --dir benchmarks/performance run start -- --project=vue --no-website
pnpm --dir benchmarks/performance run start -- --verify-only
pnpm --dir benchmarks/performance run start -- --list
pnpm --dir benchmarks/performance run start -- --sequential
```

Use `--no-website` for every targeted development run so a partial matrix cannot overwrite dashboard state.

Important control families:

- **Scope:** `--project`, `--cell-filter`, `--lint-only`, `--format-only`, `--ttsc-build-only`.
- **Setup:** `--setup-only`, `--no-setup`, `--no-install`, `--no-pack`, `--force-install`; `TTSC_BENCH_SKIP_PACK=1` is the environment equivalent of `--no-pack`.
- **Sampling:** `TTSC_BENCH_RUNS` defaults to 5, `TTSC_BENCH_WARMUP` to 1, and `TTSC_BENCH_RETRIES` to 2 for race-classified failures. `report.json` retains every raw sample; the dashboard currently reduces them to the minimum at render time.
- **Output:** `--no-website` skips dashboard merging, `--reset` discards prior measurements, `TTSC_BENCH_OUT` redirects the report, and `--verbose` enables child-process traces.
- **Disk use:** `--sequential` or `TTSC_BENCH_SEQUENTIAL=1` holds one fixture branch at a time. It is incompatible with `--setup-only` and `--no-setup`.

Setup packs the local workspace, installs it into each fixture, and runs `ttsc prepare` before measurement so plugin binaries are warm.

## Publish

Publish only from a quiet external host. `TTSC_BENCH_REQUIRE_QUIET=1` turns host-load warnings into a hard gate; `TTSC_BENCH_SKIP_LOAD_CHECK=1` is for development runs only.

Set `TTSC_BENCH_REQUIRE_QUIET` to `1` using the current shell's environment-variable syntax, then run:

```bash
pnpm --dir benchmarks/performance run start
```

After the sweep, inspect `website/public/benchmark/performance.json`. Require every fixture row, preserved row order, and a host panel matching the measurement machine. Use `pnpm --dir benchmarks/performance run merge -- <partials-dir> <website-benchmark.json>` only to combine audited partial `report.json` files by cell ID.
