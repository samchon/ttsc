# ttsc benchmark

Wall-clock benchmark comparing the legacy TypeScript toolchain against the
`ttsc` toolchain on a real backend codebase ([`shopping-backend`](https://github.com/samchon/shopping-backend),
~640 TypeScript files).

| Group | What it compares | Legacy | ttsc |
| --- | --- | --- | --- |
| **B1** Build | type-check + emit | `tsc` | `ttsc` |
| **B2** Format | format the `src` tree | `prettier` | `ttsc format` |
| **B3** Build + lint | build then lint | `tsc` + `eslint` | `ttsc` + `@ttsc/lint` |

The headline of B3 is architectural: `eslint` is a second process that re-parses
the project, while `@ttsc/lint` folds linting into the single `ttsc` compile
pass — so `ttsc` build:main *is* build + lint.

## Fixtures

Three variants of `shopping-backend` live next to this repository, under
`../nestia.examples/` (sibling of the `ttsc` checkout):

| Project | TypeScript | Toolchain |
| --- | --- | --- |
| `shopping-backend@legacy` | 5.x | `tsc` · `prettier` · `eslint` (ts-patch) |
| `shopping-backend@next` | 7.x | `ttsc` |
| `shopping-backend@experiment` | 7.x | `ttsc` · `@ttsc/lint` (lint + format configured) |

The three carry an identical source tree. `@experiment` ships a `lint.config.ts`
and `@legacy` an `eslint.config.mjs` configured with the **same 12 lint rules**
(`no-var`, `prefer-const`, `eqeqeq`, `object-shorthand`, `no-unneeded-ternary`,
`prefer-template`, `no-useless-rename`, `dot-notation`, `no-extra-boolean-cast`,
`no-useless-escape`, `prefer-as-const`, `prefer-namespace-keyword`) so B3 is a
like-for-like comparison.

## Setup

1. **Build `ttsc` tarballs from this repo** and place them where the fixtures
   expect them (`/tmp/ttsc-tgz/`):

   ```bash
   corepack enable
   pnpm install
   pnpm run build:current
   pnpm --dir packages/ttsc          pack --out /tmp/ttsc-tgz/ttsc-0.12.4.tgz
   pnpm --dir packages/ttsc-linux-x64 pack --out /tmp/ttsc-tgz/ttsc-linux-x64-0.12.4.tgz
   pnpm --dir packages/lint          pack --out /tmp/ttsc-tgz/ttsc-lint-0.12.4.tgz
   ```

   `@next`/`@experiment` reference `ttsc` (and `@ttsc/lint`) from those tarballs
   and pin the local platform package through `pnpm.overrides`.

2. **Install the fixtures** (`pnpm install` in each of the three projects).

3. **Generate prerequisites** in each project — the Prisma client and the
   nestia SDK that `build:main`/`build:test` type-check against:

   ```bash
   npm run build:prisma
   npm run build:sdk
   ```

## Run

```bash
node bench.mjs            # all groups
node bench.mjs b1 b2      # selected groups; results accumulate on disk
```

Environment overrides:

| Variable | Default | Meaning |
| --- | --- | --- |
| `TTSC_BENCH_EXAMPLES` | `../../../nestia.examples` | fixtures directory |
| `TTSC_BENCH_RUNS` | `3` | measured runs per command |
| `TTSC_BENCH_WARMUP` | `1` | warmup runs per command |
| `TTSC_BENCH_RETRIES` | `3` | retries to recover a crashed run |
| `TTSC_BENCH_OUT` | `report.md` | report destination (`.md` + `.json`) |

## Method

Each command runs `WARMUP` unmeasured times (absorbs first-run plugin
compilation and cold filesystem cache), then `RUNS` measured times; the
**median** is reported. A measured run that exits non-zero is retried up to
`RETRIES` times so the timing sample stays valid, and the crash count is
reported separately — keeping an orthogonal stability bug out of the speed
numbers.

`bench.mjs` writes a Markdown report and a `.json` sidecar; partial invocations
merge into the existing `.json`, so groups can be measured independently.
