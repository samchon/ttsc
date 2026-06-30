# @ttsc/graph benchmark

Two benchmarks, mirroring the two codegraph publishes: a structural one (`bench.mjs`, coverage and counts) and an agent-cost A/B (`agent-ab.mjs`, "X% cheaper / fewer tokens").

## Structural benchmark (`bench.mjs`)

Measures `@ttsc/graph` on a real project, the way codegraph reports coverage: how long the resident `Program` takes to load, how cheap graph extraction is on top of that already-built `Program`, the node and edge counts, and the "fair coverage" (share of symbol-bearing source files with at least one resolved cross-file edge).

The counts and coverage are deterministic. The timings are indicative and only trustworthy on a quiet host (see `.codex/skills/benchmark`); a CI run shows the shape, not a publishable figure.

### Run

```bash
# Default target: packages/ttsc (this repo's launcher source)
node experimental/benchmark/graph/bench.mjs

# Any project, with run count
node experimental/benchmark/graph/bench.mjs --project=/abs/path/to/project --tsconfig=tsconfig.json --runs=5
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

A faithful port of codegraph's headline benchmark (its `scripts/agent-eval`). For one question per repo it runs the Claude Code CLI headless twice, once with the `@ttsc/graph` MCP server and once with an empty MCP config, both under `--strict-mcp-config`, and reports codegraph's metrics: tokens summed per assistant turn (not last-turn `result.usage`), tool-call count, cost, and wall time, median over N runs. Only codegraph's two TypeScript repos are runnable by a checker-resolved graph, `excalidraw` and `vscode` (the other five are Python/Rust/Java/Go/Swift). It spends real Claude credits, is non-deterministic, and is not wired into CI. Requires `claude` and `go` on `PATH`, plus a built `@ttsc/graph` (`pnpm -C packages/graph build`), since the MCP server is the `@ttsc/graph` Node launcher: it runs `ttscgraph dump` once (the Go binary is dump-only now) and serves `graph_index` / `graph_overview` / `graph_query` / `graph_trace` / `graph_expand` over stdio.

The prompt is tool-neutral. No graph-specific guidance is appended to the user prompt; the tool guidance lives in the server's MCP initialize/tool descriptions, so both arms pose the identical question and the token comparison stays honest.

When the target checkout has no `node_modules`, the runner installs dependencies from the repo's lockfile before measuring. Use `--no-install=1` only when the checkout is already prepared for type-checking.

```bash
node experimental/benchmark/graph/agent-ab.mjs --repo=excalidraw --runs=10 --model=sonnet
node experimental/benchmark/graph/agent-ab.mjs --repo=vscode --runs=10 --model=sonnet
codegraph init /abs/path/to/repo
node experimental/benchmark/graph/agent-ab.mjs --repo=typeorm --repo-dir=/abs/path/to/repo --cg=1 --runs=1
node experimental/benchmark/graph/agent-ab-codex.mjs --repo=typeorm --repo-dir=/abs/path/to/repo --serena=1 --runs=1
```

The Serena arm runs the MCP server with `uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context <client> --project <repo>`, with the web dashboard disabled for benchmark subprocesses. Override the launcher with `--serena-command=<cmd>` and the argument list with `--serena-args='["..."]'`; `{repo}` and `{cwd}` placeholders expand to the measured checkout.

### Manifest-driven prompts

`questions/manifest.json` is the source of truth for benchmark prompts: each entry pins a question `.md`, the repo, fixture branch, tsconfig, and the question's SHA-256. Select one with `--prompt-id=<id>` (or `--prompt-family=<family>`, scoped to `--repo` when given); the harness loads that `.md` as the user prompt, verifies the SHA against the manifest, and records `promptId` and `questionSha256` on each sample and on the report.

```bash
node experimental/benchmark/graph/agent-ab.mjs --prompt-id=typeorm-dedicated-v1 --runs=4
node experimental/benchmark/graph/agent-ab.mjs --prompt-family=common --repo=typeorm --runs=4
```

Each sample captures the agent's final answer text (`answer`) — for Claude the `result` event's `result` string, falling back to the last assistant prose; for codex the last `agent_message`. The runner records that text for manual review, but it does not score answers in-process. A baseline cell is accepted only after its raw logs and final answer are inspected against the task.

The empty-MCP baseline still has a trace gate: a run that answers without any source search/read command is invalid, as is any run that uses a web tool. The gate proves the agent actually inspected the checkout; it is not an answer-quality score.

A cross-model companion, `agent-ab-codex.mjs`, drives OpenAI's codex through a minimal temp `CODEX_HOME` (a copied auth + a generated config) so the user's global config does not leak into the measurement. It defaults to GPT-5.4 mini and takes the same `--prompt-id` / `--prompt-family` flags:

```bash
node experimental/benchmark/graph/agent-ab-codex.mjs --repo=excalidraw --runs=4
node experimental/benchmark/graph/agent-ab-codex.mjs --prompt-id=typeorm-dedicated-v1 --runs=4
```

## Publish (`publish.mjs`)

Each benchmark writes a local, git-ignored report (`report.json`, `agent-ab-report.json`, `agent-ab-codex-report.json`). `publish.mjs` folds whichever exist into the committed, served `website/public/benchmark/graph.json`, the graph sibling of the performance dashboard's `performance.json`. It merges in place: the structural block is replaced whole, and each agent cell is keyed by `(harness, tool, repo, promptFamily, model, effort, fixtureBranch)` and upserted, so running one repo/model/prompt family at a time on a quiet host accumulates cells across separate runs. Only raw per-run samples are stored; medians and saved-percentages are derived by the reader, so the JSON never drifts from the prose.

```bash
node experimental/benchmark/graph/publish.mjs            # fold every report found
node experimental/benchmark/graph/publish.mjs --reset    # drop prior cells first
```

The published figures and the full method live at https://ttsc.dev/docs/benchmark/graph, the single source of truth. The headline: on Claude Sonnet 4.6 the graph cuts an agent's tokens by ~70% and tool calls by ~83% across the two repos, with the agent reading few or no files — and the win is model-dependent, since a thorough model like Opus reads source regardless of the tool. Running this surfaced the cold-start race: the server must answer the MCP handshake before it finishes type-checking, or it sits "pending" with no tools advertised and the agent falls back to grep; lazy init fixes it.
