# ttsc graph benchmark runner

AI-agent cost benchmark for `@ttsc/graph` against an empty-MCP baseline and the `codegraph`, `codebase-memory`, and `serena` comparators, plus the deterministic structural and cold-index axes that surround it.

This README is the runner reference. For published numbers and result interpretation, see https://ttsc.dev/benchmark (source: `website/src/content/docs/benchmark/graph.mdx`).

The toolchain performance benchmark is a separate package, `benchmarks/performance`.

## Quickstart

Prereq: `pnpm install` at the workspace root.

```bash
pnpm --dir benchmarks/graph run start -- --project=typeorm --models=gpt-5.4-mini --tools=ttsc-graph,codegraph,codebase-memory,serena # one agent cell
pnpm --dir benchmarks/graph run start -- --all --models=gpt-5.4-mini --arm=baseline --tools=baseline --prompt-family=all --runs=1 # baseline-only refresh
pnpm --dir benchmarks/graph run start -- --all --models=gpt-5.4-mini --arm=graph --tools=ttsc-graph,codegraph,codebase-memory,serena --prompt-family=all --runs=1 # comparator sweep
pnpm --dir benchmarks/graph run audit -- --dir=.work/graph/<timestamp>  # inspect Codex message/tool/reasoning ledger and baseline savings
pnpm --dir benchmarks/graph run audit -- --self-test                    # verify audit parser and savings semantics
pnpm --dir benchmarks/graph run structural -- --runs=5                  # structural graph metrics for packages/ttsc
pnpm --dir benchmarks/graph run index-time -- --all                     # cold index build time per (tool x fixture), quiet host only
pnpm --dir benchmarks/graph run publish -- --from <out-dir>             # publish a completed --no-website suite
```

`publish` is also a pnpm subcommand, so always spell these as `pnpm run <script>` rather than `pnpm <script>`.

Every directory these commands take — `--out`, `--from`, `--dir`, `--report` — resolves against the current directory, which `pnpm --dir benchmarks/graph` sets to this package. A `--from` directory holding no report is refused rather than published as a run that contributed nothing.

## Layout

- `src/executable/`: Short, export-free CLI bootstraps.
- `src/`: Equal-named `TtscBenchmarkGraph*` reusable modules plus the shared `TtscBenchmarkCommandLine`, `TtscBenchmarkConstant`, `TtscBenchmarkNumber`, and `TtscBenchmarkObject` helpers.
- `src/structures/`: Equal-named `ITtscBenchmarkGraph*` data contracts.
- `assets/questions/`: Tool-neutral benchmark questions and their integrity manifest.
- `.work/`: Generated reports, traces, and temporary state.

Each executable imports exactly one owning symbol and calls its `main()`:

| Executable | Package script | Owning symbol |
| --- | --- | --- |
| `src/executable/index.ts` | `start` | `TtscBenchmarkGraphRunner` |
| `src/executable/agent-ab.ts` | `agent:claude` | `TtscBenchmarkGraphClaudeAgent` |
| `src/executable/agent-ab-codex.ts` | `agent:codex` | `TtscBenchmarkGraphCodexAgent` |
| `src/executable/run-suite.ts` | `suite` | `TtscBenchmarkGraphSuite` |
| `src/executable/publish.ts` | `publish` | `TtscBenchmarkGraphPublisher` |
| `src/executable/bench.ts` | `structural` | `TtscBenchmarkGraphStructural` |
| `src/executable/index-time.ts` | `index-time` | `TtscBenchmarkGraphIndexTime` |
| `src/executable/audit-codex-traces.ts` | `audit` | `TtscBenchmarkGraphTraceAuditor` |
| `src/executable/analyze-traces.ts` | `analyze` | `TtscBenchmarkGraphTraceAnalyzer` |
| `src/executable/generate-manifest.ts` | `manifest` | `TtscBenchmarkGraphManifest` |
| `src/executable/reduce.ts` | `reduce` | `TtscBenchmarkGraphReduceCommand` |

Validate the package with `pnpm --dir benchmarks/graph run check` for strict types, and `node --experimental-transform-types scripts/ci/benchmark-source-contract.mts` from the repository root for the source contract.

## Fixtures

| Project | Fixture repo | Upstream | tsconfig |
| --- | --- | --- | --- |
| `excalidraw` | `samchon/ttsc-benchmark-excalidraw` | `excalidraw/excalidraw` | `tsconfig.json` |
| `vue` | `samchon/ttsc-benchmark-vue` | `vuejs/core` | `tsconfig.graph.json` |
| `rxjs` | `samchon/ttsc-benchmark-rxjs` | `ReactiveX/rxjs` | `tsconfig.graph.json` |
| `typeorm` | `samchon/ttsc-benchmark-typeorm` | `typeorm/typeorm` | `tsconfig.json` |
| `zod` | `samchon/ttsc-benchmark-zod` | `colinhacks/zod` | `tsconfig.graph.json` |
| `nestjs` | `samchon/ttsc-benchmark-nestjs` | `nestjs/nest` | `tsconfig.graph.json` |
| `vscode` | `samchon/ttsc-benchmark-vscode` | `microsoft/vscode` | `src/tsconfig.json` |
| `shopping-backend` | `samchon/shopping-backend` | `samchon/shopping-backend` | `tsconfig.graph.json` |

The corpus, repository metadata, and work-directory policy live in `src/TtscBenchmarkGraph.ts`. Every fixture is measured on its `graph` branch, which starts from `ttsc` but selects both source and tests so the program matches what an editor holds.

`src/executable/index.ts` clones every fixture's `graph` branch into `../graph-benchmark-work/<project>@graph` beside the repo, not into `.work/`: the measured agent's cwd is the fixture, and both Claude Code and Codex walk the parent chain for `CLAUDE.md` / `AGENTS.md`, so a fixture under this repo loads ttsc's own agent instructions into every cell.

## The run

`src/executable/index.ts` owns the agent axis. It runs projects sequentially, fixes reasoning effort to `high`, updates only its own cells in `website/public/benchmark/graph.json`, and writes a local report under `.work/graph/<timestamp>/`. Its graph tool axis is `ttsc-graph`, `codegraph`, `codebase-memory`, and `serena`; `--tools=baseline --arm=baseline` records only the empty-MCP baseline cell. Its prompt-family axis is `dedicated` and `common` (`--prompt-family=all` runs both).

Comparator setup is measured, not skipped. The `codegraph` arm runs `codegraph init`, records the index time as `toolSetupMs`, local-ignores `.codegraph/`, and deletes the index after the run unless `--keep-codegraph-index` is set. The `codebase-memory` arm runs `codebase-memory-mcp cli index_repository` with an isolated `CBM_CACHE_DIR`, records the index time as `toolSetupMs`, local-ignores `.codebase-memory/`, and deletes the cache after the run unless `--keep-codebase-memory-index` is set. The `serena` arm starts Serena's stdio MCP server through `uvx` by default, local-ignores `.serena/`, and deletes the project metadata after the run unless `--keep-serena-project` is set.

The prompt is tool-neutral. No graph-specific guidance is appended to the user prompt; tool guidance belongs in the MCP server descriptions so both arms pose the same question and the token comparison stays honest. Each sample captures the final answer for manual inspection, but the benchmark itself measures runtime behavior only: tokens, tool calls, and wall time. A graph-arm sample that completes without an MCP tool call is invalid and is retried before publication. Shell source reads and searches remain measured behavior in `shell`, `sourceTouches`, and `shellSource`; the trace audit reports that fallback instead of silently discarding the sample. If an arm has samples but no valid sample, `src/executable/index.ts` leaves the report/audit on disk and fails instead of publishing that cell.

`src/executable/index-time.ts` measures what _readiness_ costs before a tool can answer its first question: per (tool × fixture) it deletes the tool's index, runs its build step once cold, and records wall time: `ttscgraph dump` for `ttsc-graph` (the MCP launcher runs exactly this at startup), `codegraph init`, `codebase-memory-mcp cli index_repository`, and `serena project index` after the untimed project-creation interview. Each fixture also gets a scale block (tracked non-`.d.ts` TypeScript/TSX files and lines via `git ls-files`) and the run records the host, because a wall-clock number without the machine it ran on is not a measurement. One run per cell, sequential, on a quiet host, never beside the agent benchmark, whose parallel cells would corrupt every number. Results are upserted under the top-level `index` key of `website/public/benchmark/graph.json` without disturbing `structural` or `agent`; `--no-website` keeps the run local, `--reset-index` discards prior index cells instead of merging.

## Prompt corpus

`assets/questions/` holds one Markdown question file per fixture plus the shared `common.md`, and `assets/questions/manifest.json` registers every prompt outside the source tree. Each manifest entry pins an id such as `typeorm-dedicated-v1`, its repo, family (`dedicated` or `common`), question file, fixture branch, tsconfig, and the question's SHA-256, so a silently edited prompt cannot pass as the published one. Regenerate the manifest from the checked-in question files with `pnpm --dir benchmarks/graph run manifest`; the manifest carries no answers and no scoring policy.

## Trace audit

For Codex runs, `src/executable/index.ts` automatically writes `codex-trace-audit.json` beside the suite report. The audit reads every `.stream.jsonl` trace and records every exposed agent message, every shell/MCP call in timeline order, per-turn usage, and `reasoning_output_tokens`. Codex does not expose hidden reasoning text in the stream, so the audit records reasoning token counts and marks reasoning text as unavailable instead of fabricating it. It separates strict exact avoidable output such as duplicate MCP calls and legacy inline evidence text, measured graph-replaceable shell read/search output surface, candidate MCP overfetch surfaces such as broad graph traces, later-turn prompt replay exposure where the stream exposes multiple `turn.completed` events, graph-arm traces that made zero MCP calls or fell back to shell, and an input ledger comparing usage input tokens with visible trace material. The ledger's unexplained input is an accounting gap, not proof of one hidden category. By default it compares matching cells against the N=5 baseline medians in `website/public/benchmark/graph.json` and reports observed, replacement lower-bound, candidate-ceiling, and observed replay-adjusted savings; pass `--baseline=none` to disable that comparison.

Use `pnpm --dir benchmarks/graph run audit -- --compare=<before>,<after>` on audit JSON files, suite reports, or suite directories while optimizing N=1 smoke runs. The comparison uses the same exposed messages, tool calls, reasoning-token ledger, and theoretical savings fields as the full audit, so optimization decisions stay tied to trace evidence rather than anecdotal output.

## CLI flags

| Flag | Effect |
| --- | --- |
| `--project NAME` / `--all` | Select fixtures. One of the two is required. |
| `--models gpt-5.4-mini` | Select agent models for `src/executable/index.ts`. `codex` resolves to `--codex-model` and always uses effort `high`. |
| `--tools ttsc-graph,codegraph,codebase-memory,serena` | Select graph tools. Use `all` for every graph tool, or `baseline` with `--arm=baseline` to record only the empty-MCP baseline. |
| `--arm baseline` / `--arm graph` / `--arm both` | Select which harness arms to run. Baseline-only cells can be published first, then graph arms can be added later against the same website baseline. |
| `--prompt-family dedicated,common` | Select manifest prompt families. `all` expands to both. |
| `--runs N` | Measured samples per cell. |
| `--max-run-retries 4` | Retry failed agent samples this many extra times. Keep the default for publication; use `0` for N=1 smoke probes when a failure signal is more useful than spending tokens on repeated attempts. |
| `--fixture-branch graph` | Direct harness override for the graph fixture branch. The suite runner always uses the canonical `graph` branch. |
| `--daemon=1` | Use the `ttscgraph` daemon for `@ttsc/graph` cells. `codegraph` manages its own index and does not use this path. |
| `--list` | Print the resolved cell grid and exit. |
| `--out DIR` | Write the run report somewhere other than `.work/graph/<timestamp>/`. Required, with `--no-website`, for parallel sweeps. |
| `--no-website` | Do not publish into `website/public/benchmark/graph.json`. |
| `--reset` | Discard the current website cell set instead of upserting into it. |
| `--setup-only` / `--no-setup` / `--no-install` | Control fixture cloning and dependency installation. |
| `--no-codegraph-index` | Reuse an existing `.codegraph/` index instead of running `codegraph init`. |
| `--keep-codegraph-index` | Keep `.codegraph/` after the run for inspection or reuse. |
| `--codebase-memory-binary PATH` / `--cbm-binary PATH` | Use a specific `codebase-memory-mcp` binary instead of resolving it from `PATH`. |
| `--no-codebase-memory-index` | Reuse the configured `CBM_CACHE_DIR` instead of running `codebase-memory-mcp cli index_repository`. |
| `--keep-codebase-memory-index` | Keep `.codebase-memory/` and the isolated `CBM_CACHE_DIR` after the run for inspection or reuse. |
| `--no-serena-index` | Skip Serena's project indexing and reuse an existing `.serena/`. |
| `--serena-command CMD` | Use a specific Serena launcher instead of the default `uvx`. |
| `--serena-args JSON_OR_TEXT` | Override Serena MCP args. Prefer a JSON string array; `{repo}` and `{cwd}` expand to the measured checkout. |
| `--keep-serena-project` | Keep `.serena/` after the run for inspection or reuse. |
| `--tools ...` (index-time) | Select tools for `src/executable/index-time.ts`; defaults to `all`. |
| `--reset-index` (index-time) | Replace the website `index` section instead of upserting cells into it. |
| `--dir DIR` / `--report FILE` / `--compare A,B` / `--self-test` (audit) | Select what `src/executable/audit-codex-traces.ts` audits; exactly one is required. |
| `--baseline none` (audit) | Skip the published-baseline savings comparison. |
| `--from DIR` / `--reset` / `--dry-run` (publish) | Fold a finished suite directory into the website JSON, replace instead of upsert, or preview without writing. |

## Environment overrides

| Variable | Default | Meaning |
| --- | --- | --- |
| `TTSC_GRAPH_BENCH_WORK` | `../graph-benchmark-work` | Fixture clone directory, checkouts only. It defaults outside the repo so a measured agent does not inherit ttsc's `CLAUDE.md` / `AGENTS.md` from a parent directory. Reports never follow it; they stay under `.work/`. |
| `TTSC_GRAPH_BENCH_OUT` | `.work/graph/<timestamp>` | Report directory for `src/executable/index.ts`, below `--out` and above the default. |
| `TTSC_GRAPH_BENCH_TIMEOUT_MS` | `1800000` | Per-child timeout for an agent sample (`src/executable/index.ts`) and a cold-index build step (`src/executable/index-time.ts`). |
| `CODEBASE_MEMORY_MCP_BINARY` | `codebase-memory-mcp` | Binary used by the `codebase-memory` comparator when `--codebase-memory-binary` is not passed. |
| `SERENA_MCP_COMMAND` | `uvx` | Command used to launch Serena when `--serena-command` is not passed. |
| `SERENA_MCP_ARGS` | Serena's `uvx --from git+https://github.com/oraios/serena ...` args | Argument list used to launch Serena when `--serena-args` is not passed. |
| `SERENA_SOURCE` | `git+https://github.com/oraios/serena` | Package source the Serena launcher installs from when `--serena-source` is not passed. |

## Output

| File | Contents |
| --- | --- |
| `.work/graph/<timestamp>/report.json` | Per-cell agent samples: tokens, cached and reasoning tokens, turns, tool calls, reads, greps, shell calls, graph calls, source touches, cost, wall time, and attempt counts. |
| `.work/graph/<timestamp>/codex-trace-audit.json` | Codex trace audit written automatically for Codex cells: full exposed message timeline, tool-call ledger, reasoning token counts, visible-input ledger, baseline-median savings, duplicate-output exact savings, graph-replaceable shell-output surface, candidate MCP overfetch estimates, and observed later-turn prompt replay exposure. |
| `.work/graph/structural/report.json` | Deterministic structural metrics from `src/executable/bench.ts`: load time, graph build time, and the share the build adds on top of the load it rides. |
| `.work/graph-index/<timestamp>/report.json` | Cold index build time per (tool × fixture) from `src/executable/index-time.ts`, with the per-fixture scale block and the host it ran on. |
| `website/public/benchmark/graph.json` | Graph dashboard data consumed by https://ttsc.dev/benchmark. `src/executable/index.ts` upserts measured agent cells by the visible axes: harness, tool, repo, prompt id or family, stable model tier, and daemon mode. Fixture branch, effort, and setup time remain metadata and never fork a visible cell. `src/executable/publish.ts` folds local reports in, replacing the `structural` block whole and upserting agent cells by key. `src/executable/index-time.ts` owns only the top-level `index` key (`{ host, scale, cells }`), upserted by (project, tool). |

`.work/` is git-ignored; results are an ephemeral artifact and never committed. For parallel `--no-website` runs, publish afterward with `pnpm --dir benchmarks/graph run publish -- --from <out-dir>`; never let concurrent runners write `graph.json` directly.

Whenever a benchmark table is reported or published, mirror it to the active PR. Use one sticky comment headed by `<!-- ttsc-benchmark-results -->`; update that comment in place for each newer run instead of adding another comment. Include the table, report/audit paths, and any invalid or missing cells. If the branch has no PR yet, keep the table in the local report and post the sticky comment as soon as the PR exists.
