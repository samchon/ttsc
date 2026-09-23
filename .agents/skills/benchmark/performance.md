# Performance Benchmark

Read this document through the benchmark skill before running or changing the performance harness, editing its `legacy`, `ttsc`, or `ttsc-lint` fixture branches, or publishing `website/public/benchmark/performance.json`. [benchmarks/performance/README.md](../../../benchmarks/performance/README.md) is the runner reference for the matrix, fixtures, commands, flags, environment overrides, method, and outputs, and `website/src/content/docs/benchmark/performance.mdx` holds the methodology and dashboard interpretation. This document holds only the rules a change must keep.

## Fixture Contract

- Application source stays identical across the `legacy`, `ttsc`, and `ttsc-lint` branches. Only tooling files may differ: `package.json`, lockfiles, `tsconfig*.json`, ESLint and Prettier configuration, and ttsc plugin descriptors.
- `legacy` pins TypeScript to the dashboard's Legacy TypeScript major. When that headline major changes, update every fixture's `legacy` branch in the same release.
- Lint and format cells process exactly the program `tsconfig.json` selects. Do not exclude files through ignore patterns or add out-of-program files; either change makes the cells incomparable.
- Add a fixture as a new repository with all three branches plus a project entry in `benchmarks/performance/src/TtscBenchmarkPerformanceConfiguration.ts`. Never multiplex unrelated fixtures inside one repository.
- `type-fest` stays removed. Raw `tsgo` rows are a launcher-overhead reference and never eligible for the headline winner.

## Running And Publishing

- Use `--no-website` for every targeted development run so a partial matrix cannot overwrite dashboard state.
- Publish only from a quiet external host with `TTSC_BENCH_REQUIRE_QUIET=1` set. `TTSC_BENCH_SKIP_LOAD_CHECK=1` is for development runs only.
- After a publication sweep, inspect `website/public/benchmark/performance.json`: every fixture row is present, row order is preserved, and the host panel matches the measurement machine. Combine audited partial `report.json` files only with the README's `merge` command.
