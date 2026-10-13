# Performance Benchmark

[benchmarks/performance/README.md](../../../benchmarks/performance/README.md) documents the matrix, commands, and outputs.

- Application source is identical across a fixture's `legacy`, `ttsc`, and `ttsc-lint` branches; only tooling files differ. `legacy` pins the dashboard's Legacy TypeScript major.
- Lint and format process exactly the program `tsconfig.json` selects, with no ignore patterns or extra files.
- A new fixture is its own repository with all three branches and an entry in `benchmarks/performance/src/TtscBenchmarkPerformanceConfiguration.ts`. `type-fest` stays removed, and raw `tsgo` rows never win the headline.
- Use `--no-website` for development runs. Publish only from a quiet host with `TTSC_BENCH_REQUIRE_QUIET=1`, then check every fixture row and the host panel in `website/public/benchmark/performance.json`; merge partial reports only with the README's `merge` command.
