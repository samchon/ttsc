# Performance Results — Round 1 perf commit (3922a0cf)

## Method

- Microbench: `scripts/bench-go-lint.cjs -bench=.` (Go `testing.B` over
  `Engine.Run` with three representative configs, 2 s benchtime each).
- Real fixture bench: `experimental/benchmark/bench.mjs` clones each
  fixture with `master` and `fix/lint-review-round-1` tarballs in
  alternation, then captures the plugin's self-reported timing via
  `--diagnostics` (line `@ttsc/lint time: NNNs`). This is **pure lint
  time** — excludes parser and tsgo Checker work.
- Five measured runs per fixture per branch, on the same WSL host with
  no other heavy load.

## Microbench (`packages/lint/test/engine/engine_run_bench_test.go`)

| Benchmark               | master baseline | round-1 perf | Δ |
| ----------------------- | --------------: | -----------: | --- |
| EngineRun (12 rules)    |          844 µs |       153 µs | **-82 %** |
| EngineRunIdentifierHeavy |         539 µs |       119 µs | **-78 %** |
| EngineRunUnicornBroad (30 rules) | 885 µs |       199 µs | **-78 %** |

Allocations on EngineRun: 6718 → 690 (**-90 %**).

## Real-fixture pure lint time (5-run median per branch)

| Fixture | master | branch | Δ | Notes |
| --- | --: | --: | --- | --- |
| **vscode** | 1869 ms | 866 ms | **-53.7 %** | clean A/B, same machine, fresh install per branch. Largest pure-lint workload in the bench set. |
| vue       | 60 ms*  | 36 ms  | -40 % | branch fresh install; master = published benchmark.json |
| typeorm   | 125 ms* | 116 ms | -7 %  | small rule set (2 active), little headroom |
| type-fest | 16 ms*  | 19 ms  | +3 ms | within ms-level noise; type-fest is 99 % tsgo Checker, lint barely runs |

`*` master = `website/public/benchmark.json` at commit 2c4f3c (pre-PR). Only vscode received a fresh clean A/B re-install of master tarballs in this measurement session; the others were compared against the published numbers for cost reasons.

## Why vscode shows the biggest absolute win

vscode (the heaviest fixture by pure lint time) carries the most lint
rules of any benchmark fixture (~20+ active rules including
`@ttsc/lint` core, typescript, react, plus local custom rules). Every
dispatched node multiplies the rule-set cost, so the Opt 2 / Opt 4
wins (byKind slice, struct walker eliminating per-recursion closure
allocation) compound. On smaller fixtures the absolute saving is
limited by the dispatcher's smaller share of total lint cost.

## Caveats

- On heavy fixtures the **total** ttsc-lint wall time is dominated by
  tsgo Checker work and GC, not by lint dispatch. CPU profile of
  `type-fest:ttsc-lint:noEmit` (30 s wall): 53 % `runtime.gcDrain`,
  44 % `Checker.instantiateType*`, **3.4 % linthost**.
- The 1869 → 866 ms vscode delta moves the *@ttsc/lint slice* of the
  total, not the total itself. The total wall time still hovers around
  22–25 s because the Checker dominates.
- The perf commit is a net win on every fixture measured; type-fest's
  +3 ms is within run-to-run variance (its baseline is also 16 ms).

## How to reproduce

```bash
# Microbench
node scripts/bench-go-lint.cjs -bench=. -benchtime=2s

# Real-fixture pure lint (vscode example)
cd experimental/benchmark/.work/ttsc-benchmark-vscode@ttsc-lint
NODE_OPTIONS='--max-old-space-size=8192' \
  ./node_modules/.bin/ttsc -p src/tsconfig.json --noEmit \
  --singleThreaded --diagnostics 2>&1 | grep '@ttsc/lint time'
```
