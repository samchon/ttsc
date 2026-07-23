# Graph AI Benchmark

Read this document before running or changing `experimental/benchmark/graph.mjs`, graph benchmark prompts or fixtures, trace auditing, comparator setup, or `website/public/benchmark/graph.json` publication.

## Workload And Fixtures

This benchmark measures AI-agent cost with an empty-MCP baseline and the `ttsc-graph`, `codegraph`, `codebase-memory`, and `serena` tool arms. It runs projects sequentially and fixes reasoning effort to `high`. Prompt families are `common` and `dedicated`; `shared-onboarding` and `project-specific` remain accepted aliases.

Graph fixtures use each benchmark repository's `graph` branch. The runner clones them beside this repository as `../graph-benchmark-work/<project>@graph` and installs each fixture from its own lockfile.

Keeping fixtures outside the ttsc checkout is part of measurement validity. Claude Code and Codex walk parent directories for `CLAUDE.md` and `AGENTS.md`; a fixture nested here can read ttsc's instructions and contaminate the result. Use the plain agent-visible project name such as `vue@graph`, not a harness-oriented prefix.

The graph branch starts from `ttsc` but uses `tsconfig.graph.json` to include both source and tests, matching the program an editor holds. Never point it at an emit-only build config. A test-less program forces the agent to search the filesystem for tests and changes the workload.

## Comparator Setup

- **codegraph:** run `codegraph init`, record setup as `toolSetupMs`, local-ignore `.codegraph/`, and remove it unless `--keep-codegraph-index` is set.
- **codebase-memory:** run `codebase-memory-mcp cli index_repository` with an isolated `CBM_CACHE_DIR`, record `toolSetupMs`, local-ignore `.codebase-memory/`, and remove it unless `--keep-codebase-memory-index` is set.
- **Serena:** launch the documented stdio server through `uvx`, run its prescribed project indexing, local-ignore `.serena/`, and remove it unless `--keep-serena-project` is set.

The benchmark measures setup time; it must not omit required setup to make a comparator look worse.

## Run And Audit

```bash
node experimental/benchmark/graph.mjs --project=typeorm --models=gpt-5.4-mini --tools=ttsc-graph,codegraph,codebase-memory,serena
node experimental/benchmark/graph.mjs --all --models=gpt-5.4-mini --arm=baseline --tools=baseline --prompt-family=all --runs=1
node experimental/benchmark/graph/audit-codex-traces.mjs --dir=experimental/benchmark/.work/graph/<timestamp>
node experimental/benchmark/graph/audit-codex-traces.mjs --compare=<before>,<after>
node experimental/benchmark/graph/audit-codex-traces.mjs --self-test
```

Use `--arm=baseline --tools=baseline` to refresh only the empty-MCP baseline. Use `--arm=graph --tools=ttsc-graph,codegraph,codebase-memory,serena` to add tool samples against published baselines.

Do not add `--reset` to an ordinary refresh. It discards the current website cell set before writing the first new cell. Use it only when intentionally rebuilding the entire graph dashboard in the same publication sequence.

Shell source reads in a graph arm are measured behavior, not an invalid sample. Preserve them in `shell`, `sourceTouches`, `graph`, and `attempts`. Exclude only zero-token infrastructure or capacity failures from published results.

Publication uses `--max-run-retries=4` so transient agent failures do not erase a cell. A one-run diagnostic may use `--max-run-retries=0` when repeated attempts would hide the failure being studied.

VS Code is a global single lane. Never run two `vscode` cells concurrently, though other projects may run beside one VS Code cell.

## Sampling And Publication

The public graph dashboard stores one run per cell on the selected mid-size model tiers. Repository breadth is the sample; do not average a bad cell away. Preserve `runs: 1` in website JSON. This rule is separate from the five-run median used by the toolchain performance benchmark.

Parallel graph sweeps must use `--no-website` and unique `--out` directories. Publish completed suites afterward:

```bash
node experimental/benchmark/graph/publish.mjs --from <out-dir>
```

Never let concurrent runners write `graph.json` directly.

`experimental/benchmark/graph/website-cell.mjs` is the single published-cell key. Key only by fields the website renders. Metadata such as fixture branch, reasoning effort, or setup time must not create a second visible copy of the same cell.

## Trace Audit

Codex suites write `codex-trace-audit.json` automatically. Run `audit-codex-traces.mjs` directly only to re-audit existing output or compare before and after runs.

The audit records exposed assistant messages, shell and MCP calls in timeline order, per-turn usage, and `reasoning_output_tokens`. Codex does not expose hidden reasoning text; never invent it.

Interpret its categories carefully:

- exact avoidable output includes duplicate MCP calls and legacy inline evidence;
- graph-replaceable shell output is a measured lower-bound surface;
- broad graph traces and similar overfetch are candidate ceilings, not automatically avoidable;
- later `turn.completed` events expose possible prompt replay;
- unexplained input is an accounting gap, not proof of a hidden category.

The report provides observed, replacement lower-bound, candidate-ceiling, and replay-adjusted savings. Use `--compare=<before>,<after>` for the same token, reasoning, tool, and savings fields. Use `--baseline=none` when no website comparison is wanted.

## Changing `@ttsc/graph`

The following product decisions are closed:

- No benchmark-only hardcoding, monkey patches, or over-fitting.
- Never suppress a legitimate agent follow-up to improve the number.
- Closures stay out of tours as seeds, reach, and flows because they explode the graph.
- A tour is an index-level overview, not a path-stitching engine; seed-to-seed bridges remain withdrawn.

### Compute Blast Radius First

Ranking changes propagate through the whole tour: seed order changes flows, which change nearby nodes, tests, and anchors. A change that appears to reorder only seeds can change every downstream field.

Before spending model tokens, run the old and new tours offline for every repository and prompt-family cell. Diff the payloads and predict the effect of every changed cell. Byte-identical payloads cannot reflect a server-side change.

### Re-Measure The Whole Arm

Any graph logic, instruction, schema, tool description, or runner text change requires every `ttsc-graph` cell across all repositories, models, and both prompt families to be re-measured and compared with published `graph.json`.

A cell that loses reduction, adds calls, or newly reads files blocks merge until its trace explains the cause and the cause is fixed. Validate cells individually, not by family average. Baseline and comparator arms may stand when the changed code cannot affect them.

### Keep Tool Claims True

The audit may claim only facts the server checked. The `next` field may state only what the returned graph establishes; it cannot infer what the question meant or whether identifier text semantically covered it.

Do not add an instruction that suppresses a legitimate follow-up or invents a reason to drill. `RESULT_AUDIT` permits another graph call when `next` says inspect, so a false inspect signal defeats the stop rule.

### Treat Surprises As Failed Understanding

A single-cell change can alter seed coverage, grow flow payloads, or remove anchors the model uses as citations in another repository. State the predicted effect on every moved cell before measurement. If reality contradicts the prediction, investigate or revert before stacking another patch.
