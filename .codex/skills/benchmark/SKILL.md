# Benchmark

## What it measures

`ttsc + @ttsc/lint + ttsc format` versus the legacy `tsc + eslint + prettier` toolchain, on seven real-world TypeScript projects. The runner clones each fixture's three branches into `experimental/benchmark/.work/`, replays each cell `RUNS` times, and writes the medians to `website/public/benchmark.json` for the public dashboard at https://ttsc.dev/benchmark.

Cell ID = `project:branch:op:threading`.

| Axis | Values |
| --- | --- |
| Project | `vue`, `rxjs`, `typeorm`, `zod`, `nestjs`, `vscode`, `shopping-backend` |
| Branch | `legacy`, `ttsc`, `ttsc-lint` |
| Op | `build`, `noEmit`, `eslint` (legacy only), `format` |
| Threading | `single`, `checkers2`, `checkers4`, `checkers8` (`format` keeps `single` + default `multi`) |

Methodology, per-axis interpretation, and dashboard tabs are documented in `website/src/content/docs/benchmark.mdx`. Flags and env vars are tabled in `experimental/benchmark/README.md`. This skill covers the higher-level rules that those references assume.

## Running

```bash
node experimental/benchmark/bench.mjs                              # full matrix sweep
node experimental/benchmark/bench.mjs --project=vue --no-website   # one fixture, do not touch dashboard
node experimental/benchmark/bench.mjs --verify-only                # one pass per cell, no timing
node experimental/benchmark/bench.mjs --list                       # print resolved grid
node experimental/benchmark/bench.mjs --sequential                 # clone→measure→delete one fixture at a time (CI / low-disk)
```

Option families:

- **Scope** — `--project`, `--cell-filter`, `--lint-only`, `--format-only`, `--ttsc-build-only`. Every targeted run pairs with `--no-website` so the dashboard stays consistent.
- **Setup** — `--setup-only`, `--no-setup`, `--no-install`, `--no-pack` (or `TTSC_BENCH_SKIP_PACK=1`), `--force-install`. Setup packs the local `ttsc` workspace into tarballs, clones the fixtures, installs the tarballs, and runs `ttsc prepare` so plugin binaries are warm before any measured cell.
- **Sampling** — `TTSC_BENCH_RUNS` (5), `TTSC_BENCH_WARMUP` (1), `TTSC_BENCH_RETRIES` (2, applied only to `race`-classified failures). The reported number is the median; `min` and the full sample list stay in `report.json` for audit.
- **Host gate** — `TTSC_BENCH_REQUIRE_QUIET=1` upgrades the load-average warning into a hard error and is set for every publication run; `TTSC_BENCH_SKIP_LOAD_CHECK=1` silences it for development iterations.
- **Output** — `--no-website` skips merging into `website/public/benchmark.json`; `--reset` discards prior measurements instead of merging in place; `TTSC_BENCH_OUT` redirects the local report; `--verbose` tees child stdio with `[cmd]` / `[step]` / `[timer]` traces (default is milestone-only).
- **Disk-cheap mode** — `--sequential` (env `TTSC_BENCH_SEQUENTIAL=1`) holds only one `(project, branch)` clone in `.work/` at a time: clone, measure, delete, next. Used by the GitHub Actions workflow `.github/workflows/benchmark.yml`. Incompatible with `--setup-only` / `--no-setup`.

Publication sweep:

```bash
TTSC_BENCH_REQUIRE_QUIET=1 node experimental/benchmark/bench.mjs
```

After the sweep, inspect the diff against `website/public/benchmark.json`: every fixture row present, row order preserved, host panel reflects the machine that produced the numbers.

## Fixture repositories

Each fixture is a forked GitHub repo at `samchon/ttsc-benchmark-<name>`, plus `samchon/shopping-backend` for the plugin-heavy case. Every fixture carries three independent branches:

- **`legacy`** — upstream source with stock `tsc`, `eslint`, and `prettier`. TypeScript pinned to the Legacy TypeScript version shown on the dashboard host panel (currently `v6.0.3`).
- **`ttsc`** — same source as `legacy`, with `tsc` swapped for `ttsc` on `@typescript/native-preview` and the workspace configured to install `ttsc` from the tarball the runner packs.
- **`ttsc-lint`** — same source as `ttsc`, with `@ttsc/lint` folded into the compile pass so the `eslint` step is no longer invoked.

### Source parity

The three branches differ only in tooling — `package.json`, `tsconfig*.json`, `eslint.config.*`, `.prettierrc*`, lockfile, `ttsc` plugin descriptors. Application source is identical across `legacy`, `ttsc`, and `ttsc-lint`, so a cell delta reflects tool cost rather than workload drift.

### Lint and format scope is the tsconfig program

Across `legacy` and `ttsc-lint`, the lint and format cells process exactly the file set `tsconfig.json` compiles for that fixture. `eslint` and `@ttsc/lint` lint that set; `prettier --check` and `ttsc format` format that set.

Nothing inside the program is excluded; nothing outside it is targeted. Carve-outs via `--ignore-pattern`, `eslint.config` `ignores`, `.prettierignore`, or extra `files`/`exclude` entries are rejected because they make the cells incomparable.

### Editing workflow

Edits go to the fixture repo on GitHub, not to the local clone. Setup runs `fetch + reset --hard` to the upstream branch tip on every run, so local changes in `.work/` disappear immediately.

Finish every fixture-branch edit by running the branch's own build, format, and lint commands (e.g. `pnpm build`, `prettier --write` or `ttsc format`, `eslint --fix`) until the tree is green, then commit and push. A half-finished tip pollutes every later run because the runner pulls upstream every setup.

READMEs and prose docs inside a fixture repo follow the same writing rules as ttsc itself — see AGENTS.md `## Maintenance § Writing style` and `.codex/skills/documentation/SKILL.md § READMEs`.

### Other rules

- **No tarball or built artifact in the fixture.** The runner packs and installs the local `ttsc` workspace during setup. The fixture repo must not carry pre-baked tarball paths, vendored `ttsc` builds, or stale `dist/` output.
- **Pin major TypeScript in lockstep.** When the Legacy TypeScript headline version bumps, update every fixture's `legacy` branch in the same release so the `tsc` baseline stays one major across the matrix.
- **Add fixtures by adding repos.** A new fixture means a new `samchon/ttsc-benchmark-<name>` repo carrying all three branches, plus a `PACKAGE_CONFIGS` entry at the top of `bench.mjs`. Multi-fixture tricks inside one repo are out of scope.
- **Removed comparisons stay removed.** `tsgo` rows and the `type-fest` fixture were dropped deliberately.
