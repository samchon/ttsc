# Toolchain Performance Benchmark

Read this document before running or changing `experimental/benchmark/performance.mjs`, editing its `legacy`, `ttsc`, or `ttsc-lint` fixture branches, or publishing `website/public/benchmark/performance.json`.

## Workload

The benchmark compares `ttsc + @ttsc/lint + ttsc format` with `tsc + eslint + prettier` on seven real TypeScript projects. The runner clones three branches per fixture into `experimental/benchmark/.work/`, warms the configured toolchain, replays each cell, and publishes medians to the dashboard at https://ttsc.dev/benchmark.

Cell ID is `project:branch:op:threading`.

| Axis | Values |
| --- | --- |
| Project | `vue`, `rxjs`, `typeorm`, `zod`, `nestjs`, `vscode`, `shopping-backend` |
| Branch | `legacy`, `ttsc`, `ttsc-lint` |
| Operation | `build`, `noEmit`, `eslint` (legacy only), `format` |
| Threading | `single`, `checkers2`, `checkers4`, `checkers8`; format uses `single` and default `multi` |

The detailed methodology and dashboard interpretation live in `website/src/content/docs/benchmark/performance.mdx`. The full flag and environment-variable table lives in `experimental/benchmark/README.md`.

## Fixture Contract

Each fixture is `samchon/ttsc-benchmark-<name>`, except the plugin-heavy `samchon/shopping-backend`.

- **`legacy`:** upstream source using stock `tsc`, ESLint, and Prettier. Pin TypeScript to the dashboard's Legacy TypeScript major.
- **`ttsc`:** the same source using the pinned TypeScript-Go runtime and workspace-packed ttsc.
- **`ttsc-lint`:** the same source as `ttsc`, with `@ttsc/lint` folded into compilation instead of a separate ESLint step.

Application source must remain identical across the three branches. Tooling files may differ: `package.json`, lockfiles, `tsconfig*.json`, ESLint and Prettier configuration, and ttsc plugin descriptors.

Lint and format cells process exactly the program selected by `tsconfig.json`. Do not exclude files through ignore patterns or add out-of-program files; either change makes the cells incomparable.

When the Legacy TypeScript headline major changes, update every fixture's `legacy` branch in the same release. Add a fixture by adding a repository with all three branches and a `PACKAGE_CONFIGS` entry in `performance.mjs`; do not multiplex unrelated fixtures inside one repository.

`type-fest` remains deliberately removed. Raw `tsgo` rows remain a launcher-overhead reference and are not eligible for the headline winner.

## Run Locally

```bash
node experimental/benchmark/performance.mjs
node experimental/benchmark/performance.mjs --project=vue --no-website
node experimental/benchmark/performance.mjs --verify-only
node experimental/benchmark/performance.mjs --list
node experimental/benchmark/performance.mjs --sequential
```

Use `--no-website` for every targeted development run so a partial matrix cannot overwrite dashboard state.

Important control families:

- **Scope:** `--project`, `--cell-filter`, `--lint-only`, `--format-only`, `--ttsc-build-only`.
- **Setup:** `--setup-only`, `--no-setup`, `--no-install`, `--no-pack`, `--force-install`; `TTSC_BENCH_SKIP_PACK=1` is the environment equivalent of `--no-pack`.
- **Sampling:** `TTSC_BENCH_RUNS` defaults to 5, `TTSC_BENCH_WARMUP` to 1, and `TTSC_BENCH_RETRIES` to 2 for race-classified failures. `report.json` retains the minimum and every raw sample in addition to the median.
- **Output:** `--no-website` skips dashboard merging, `--reset` discards prior measurements, `TTSC_BENCH_OUT` redirects the report, and `--verbose` enables child-process traces.
- **Disk use:** `--sequential` or `TTSC_BENCH_SEQUENTIAL=1` holds one fixture branch at a time. It is incompatible with `--setup-only` and `--no-setup`.

Setup packs the local workspace, installs it into each fixture, and runs `ttsc prepare` before measurement so plugin binaries are warm.

## Publish

Publish only from a quiet external host. `TTSC_BENCH_REQUIRE_QUIET=1` turns host-load warnings into a hard gate; `TTSC_BENCH_SKIP_LOAD_CHECK=1` is for development runs only.

Set `TTSC_BENCH_REQUIRE_QUIET` to `1` using the current shell's environment-variable syntax, then run:

```bash
node experimental/benchmark/performance.mjs
```

After the sweep, inspect `website/public/benchmark/performance.json`. Require every fixture row, preserved row order, and a host panel matching the measurement machine. Use `merge-website.mjs` only to combine audited partial `report.json` files by cell ID.
