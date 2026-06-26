# @ttsc/graph benchmark

Two benchmarks, mirroring the two codegraph publishes: a structural one (`bench.mjs`, coverage and counts) and an agent-cost A/B (`agent-ab.mjs`, "X% cheaper / fewer tokens").

## Structural benchmark (`bench.mjs`)

Measures `@ttsc/graph` on a real project, the way codegraph reports coverage: how long the resident `Program` takes to load, how cheap graph extraction is on top of that already-built `Program`, the node and edge counts, and the "fair coverage" (share of symbol-bearing source files with at least one resolved cross-file edge).

The counts and coverage are deterministic. The timings are indicative and only trustworthy on a quiet host (see `.codex/skills/benchmark`); a CI run shows the shape, not a publishable figure.

### Run

```bash
# Default target: packages/ttsc (this repo's launcher source)
node experimental/graph-bench/bench.mjs

# Any project, with run count
node experimental/graph-bench/bench.mjs --project=/abs/path/to/project --tsconfig=tsconfig.json --runs=5
```

It builds the `cmd/graphbench` metrics binary once, runs it `--runs` times (plus one warmup), and writes `report.json` next to this file.

### What it reports

A CI run against this repo's `packages/ttsc` (53 source files) reported:

```
Result (counts deterministic; timings indicative):
  source files:  53
  nodes:         605 (71 external boundary leaves)
  edges:         1583 (heritage 2, value-call 1153, type-ref 428)
  fair coverage: 100.0% (50/50 symbol-bearing files cross-linked)
  load time:     69 ms (median)
  graph build:   42 ms (median), 60.1% on top of the load it rides
```

Read the coverage as the codegraph-style flex: 100% of symbol-bearing files have at least one checker-resolved cross-file edge. The `graph build ... % on top of the load it rides` line is honest about cost: on a small project the walk is a real fraction of the (already fast) load, and the ratio shrinks as type-checking dominates on larger trees. The point is not that extraction is free, but that it rides the `Program` the compiler already built, so the server answers queries without a second compile or an external language-server round-trip.

## Agent-cost A/B (`agent-ab.mjs`)

A faithful port of codegraph's headline benchmark (its `scripts/agent-eval`). For one question per repo it runs the Claude Code CLI headless twice, once with the `@ttsc/graph` MCP server and once with an empty MCP config, both under `--strict-mcp-config`, and reports codegraph's metrics: tokens summed per assistant turn (not last-turn `result.usage`), tool-call count, cost, and wall time, median over N runs. Only codegraph's two TypeScript repos are runnable by a checker-resolved graph, `excalidraw` and `vscode` (the other five are Python/Rust/Java/Go/Swift). It spends real Claude credits, is non-deterministic, and is not wired into CI. Requires `claude` and `go` on `PATH`, plus a built `@ttsc/graph` (`pnpm -C packages/graph build`), since the MCP server is the `@ttsc/graph` Node launcher: it runs `ttscgraph dump` once (the Go binary is dump-only now) and serves `graph_overview` / `graph_query` / `graph_trace` / `graph_expand` over stdio.

The prompt is tool-neutral. No graph-specific guidance is appended to the user prompt; the tool guidance lives in the server's MCP initialize/tool descriptions, so both arms pose the identical question and the token comparison stays honest.

```bash
node experimental/graph-bench/agent-ab.mjs --repo=excalidraw --runs=10 --model=sonnet
node experimental/graph-bench/agent-ab.mjs --repo=vscode --runs=10 --model=sonnet
codegraph init /abs/path/to/repo
node experimental/graph-bench/agent-ab.mjs --repo=typeorm --repo-dir=/abs/path/to/repo --cg=1 --runs=1
```

### Manifest-driven prompts and grading

`questions/manifest.json` is the source of truth for graded prompts: each entry pins a question `.md`, a gold `.json`, the repo/fixtureBranch/tsconfig, and the question's SHA-256. Select one with `--prompt-id=<id>` (or `--prompt-family=<family>`, scoped to `--repo` when given); the harness loads that `.md` as the user prompt, verifies the SHA against the manifest, and records `promptId`, `questionSha256`, and `goldSha256` on each sample and on the report.

```bash
node experimental/graph-bench/agent-ab.mjs --prompt-id=typeorm-overview-v1 --runs=4
node experimental/graph-bench/agent-ab.mjs --prompt-family=overview --repo=typeorm --runs=4
```

Each sample captures the agent's final answer text (`answer`) — for Claude the `result` event's `result` string, falling back to the last assistant prose; for codex the last `agent_message`. After capture, the harness grades the answer in-process against the prompt's gold via `grade.mjs`'s `gradeAnswer`, and stores the per-axis result on the sample as `quality` (with `pass`). The console prints each arm's pass rate, and a token saving is **not** presented as a win when the graph arm's answers fall below threshold (default `0.8`, override with `--threshold`).

The standalone `grade.mjs --report=<path>` CLI re-grades offline (e.g. after editing a gold) against any report whose samples are a flat array of `{ promptId, answer }`. The A/B report keys `samples` by arm (`{ baseline, graph }`) for the dashboard, so flatten before piping it to the CLI, or just read the `quality` the harness already wrote on each sample:

```bash
node -e "const r=require('./experimental/graph-bench/agent-ab-report.json');require('fs').writeFileSync('/tmp/flat.json',JSON.stringify({samples:[].concat(...Object.values(r.samples))}))"
node experimental/graph-bench/grade.mjs --report=/tmp/flat.json
```

A cross-model companion, `agent-ab-codex.mjs`, drives OpenAI's codex (GPT-5.5) through a minimal temp `CODEX_HOME` (a copied auth + a generated config) so the user's global config does not leak into the measurement. It takes the same `--prompt-id` / `--prompt-family` / `--threshold` flags and captures + grades the answer the same way:

```bash
node experimental/graph-bench/agent-ab-codex.mjs --repo=excalidraw --runs=4
node experimental/graph-bench/agent-ab-codex.mjs --prompt-id=typeorm-overview-v1 --runs=4
```

## Publish (`publish.mjs`)

Each benchmark writes a local, git-ignored report (`report.json`, `agent-ab-report.json`, `agent-ab-codex-report.json`). `publish.mjs` folds whichever exist into the committed, served `website/public/benchmark/graph.json`, the graph sibling of the performance dashboard's `performance.json`. It merges in place: the structural block is replaced whole, and each agent cell is keyed by `(harness, tool, repo, promptFamily, model, effort, fixtureBranch)` and upserted, so running one repo/model/prompt family at a time on a quiet host accumulates cells across separate runs. Only raw per-run samples are stored; medians and saved-percentages are derived by the reader, so the JSON never drifts from the prose.

```bash
node experimental/graph-bench/publish.mjs            # fold every report found
node experimental/graph-bench/publish.mjs --reset    # drop prior cells first
```

The published figures and the full method live at https://ttsc.dev/docs/benchmark/graph, the single source of truth. The headline: on Claude Sonnet 4.6 the graph cuts an agent's tokens by ~70% and tool calls by ~83% across the two repos, with the agent reading few or no files — and the win is model-dependent, since a thorough model like Opus reads source regardless of the tool. Running this surfaced the cold-start race: the server must answer the MCP handshake before it finishes type-checking, or it sits "pending" with no tools advertised and the agent falls back to grep; lazy init fixes it.
