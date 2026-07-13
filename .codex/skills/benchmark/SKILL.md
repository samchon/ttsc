---
name: benchmark
description: Benchmark runner, fixture repos, and publication. Read before running, modifying, or publishing benchmark results.
---

# Benchmark

## What it measures

`ttsc + @ttsc/lint + ttsc format` versus the legacy `tsc + eslint + prettier` toolchain, on seven real-world TypeScript projects. `experimental/benchmark/performance.mjs` clones each fixture's three branches into `experimental/benchmark/.work/`, replays each cell `RUNS` times, and writes the medians to `website/public/benchmark/performance.json` for the public dashboard at https://ttsc.dev/benchmark.

`experimental/benchmark/graph.mjs` is a separate AI-token benchmark for `@ttsc/graph` and graph-MCP comparators. It owns its fixtures: the `graph` branch of each benchmark repo, cloned into `../graph-benchmark-work/` beside this repo and installed from the fixture's own lockfile. It runs projects sequentially, fixes reasoning effort to `high`, and upserts its own cells into `website/public/benchmark/graph.json`. The `codegraph` arm runs `codegraph init` before the agent cells, records that setup as `toolSetupMs`, local-ignores `.codegraph/`, and removes the index unless `--keep-codegraph-index` is passed. The `codebase-memory` arm runs `codebase-memory-mcp cli index_repository` with an isolated `CBM_CACHE_DIR`, records that setup as `toolSetupMs`, local-ignores `.codebase-memory/`, and removes the cache unless `--keep-codebase-memory-index` is passed. The `serena` arm starts Serena's stdio MCP server through `uvx` by default, local-ignores `.serena/`, and removes the project metadata unless `--keep-serena-project` is passed.

Cell ID = `project:branch:op:threading`.

| Axis | Values |
| --- | --- |
| Project | `vue`, `rxjs`, `typeorm`, `zod`, `nestjs`, `vscode`, `shopping-backend` |
| Branch | `legacy`, `ttsc`, `ttsc-lint` |
| Op | `build`, `noEmit`, `eslint` (legacy only), `format` |
| Threading | `single`, `checkers2`, `checkers4`, `checkers8` (`format` keeps `single` + default `multi`) |

Methodology, per-axis interpretation, and dashboard tabs are documented in `website/src/content/docs/benchmark/performance.mdx`. Flags and env vars are tabled in `experimental/benchmark/README.md`. This skill covers the higher-level rules that those references assume.

## Running

```bash
node experimental/benchmark/performance.mjs                              # full matrix sweep
node experimental/benchmark/performance.mjs --project=vue --no-website   # one fixture, do not touch dashboard
node experimental/benchmark/performance.mjs --verify-only                # one pass per cell, no timing
node experimental/benchmark/performance.mjs --list                       # print resolved grid
node experimental/benchmark/performance.mjs --sequential                 # clone, measure, delete one fixture at a time (low-disk)
node experimental/benchmark/graph.mjs --project=typeorm --models=gpt-5.4-mini --tools=ttsc-graph,codegraph,codebase-memory,serena # one graph AI-token fixture
node experimental/benchmark/graph.mjs --all --models=gpt-5.4-mini --arm=baseline --tools=baseline --prompt-family=all --runs=5 --reset # baseline-only publication refresh
node experimental/benchmark/graph/audit-codex-traces.mjs --dir=experimental/benchmark/.work/graph/<timestamp> # inspect Codex messages/tools/reasoning tokens and baseline savings
node experimental/benchmark/graph/audit-codex-traces.mjs --compare=<before>,<after> # compare smoke-run audit/report dirs during optimization
node experimental/benchmark/graph/audit-codex-traces.mjs --self-test # regression-check audit parsing and savings semantics
```

Option families:

- **Scope**: `--project`, `--cell-filter`, `--lint-only`, `--format-only`, `--ttsc-build-only`. Every targeted run pairs with `--no-website` so the dashboard stays consistent.
- **Setup**: `--setup-only`, `--no-setup`, `--no-install`, `--no-pack` (or `TTSC_BENCH_SKIP_PACK=1`), `--force-install`. Setup packs the local `ttsc` workspace into tarballs, clones the fixtures, installs the tarballs, and runs `ttsc prepare` so plugin binaries are warm before any measured cell.
- **Sampling**: `TTSC_BENCH_RUNS` (5), `TTSC_BENCH_WARMUP` (1), `TTSC_BENCH_RETRIES` (2, applied only to `race`-classified failures). The reported number is the median; `min` and the full sample list stay in `report.json` for audit.
- **Host gate**: `TTSC_BENCH_REQUIRE_QUIET=1` upgrades the load-average warning into a hard error and is set for every publication run; `TTSC_BENCH_SKIP_LOAD_CHECK=1` silences it for development iterations.
- **Output**: `--no-website` skips merging into `website/public/benchmark/performance.json`; `--reset` discards prior measurements instead of merging in place; `TTSC_BENCH_OUT` redirects the local report; `--verbose` tees child stdio with `[cmd]` / `[step]` / `[timer]` traces (default is milestone-only).
- **Graph arms**: `graph.mjs --arm=baseline --tools=baseline` records only the empty-MCP baseline. Later `--arm=graph --tools=ttsc-graph,codegraph,codebase-memory,serena` runs add comparator samples against those website baseline cells. Prompt families are `dedicated` and `common`; `project-specific` and `shared-onboarding` remain accepted aliases. Graph-arm fallback to shell source reads/searches is a real measured outcome, not an invalid result; keep it visible through `shell`, `sourceTouches`, `graph`, and `attempts`. Exclude only zero-token infrastructure/capacity failures from published medians.
- **Graph publication**: parallel graph sweeps must run with `--no-website` and unique `--out` directories, then publish afterward with `node experimental/benchmark/graph/publish.mjs --from <out-dir>` for each completed suite. Direct concurrent writes to `website/public/benchmark/graph.json` can race.
- **A published cell is keyed by what the site renders**, and by nothing else: `experimental/benchmark/graph/website-cell.mjs` is the single definition, and every writer of `graph.json` imports it. Keying on metadata that merely rides along with a run — the fixture branch, the reasoning effort, the tool's setup time — makes a re-measurement land _beside_ the old cell instead of replacing it, and the grid then renders the same model twice. That shipped to ttsc.dev once.
- **Comparators get the setup their own documentation prescribes.** serena's `serena project index` went unrun for months; with it, serena's savings moved from −26%…28% to 0…49%. A benchmark that withholds a tool's prescribed setup is measuring the withholding, and the reader is right not to trust the rest of the grid.
- **Graph fixtures are the `graph` branch, outside the repo**: `graph.mjs` clones each benchmark repo's `graph` branch into `../graph-benchmark-work/<project>@graph`, installs it from its own lockfile, and never touches the performance sweep's `.work/` clones. The branch split keeps a graph-only fixture edit (a tsconfig whose program includes the tests) from changing what the `tsc`-vs-`ttsc` cells compile. The directory split keeps ttsc's own `CLAUDE.md` / `AGENTS.md` out of the measurement: the agent's cwd is the fixture, and both CLIs walk the parent chain for them (a vscode run under `experimental/benchmark/.work` was caught reading this repo's `AGENTS.md` instead of touring vscode). A graph number measured from a fixture under this repo is contaminated — re-measure it, do not publish it.
- **Agent-visible names matter**: the folder is the agent's cwd, so it is the plain project name (`vue@graph`), never `ttsc-benchmark-vue@…` — the prefix makes an agent hunt for harness code instead of touring the source.
- **VS Code graph lane**: `vscode` graph benchmark runs are globally single-lane. Do not run two `vscode` graph cells at the same time, even if the tool, model, or prompt family differs. Other projects may run in parallel while one `vscode` cell runs.
- **Graph sampling and model**: the public graph dashboard is N=1 on a mid-size model (Sonnet 5, GPT-5.6 Terra, and similarly priced tiers), not N=5 on a frontier model. Both the published cells and the optimization loops behind them use this setting. The graph instruction/schema is tuned continuously, so the dashboard must be cheap to re-measure; a frontier N=5 sweep would exhaust the weekly quota, freeze the numbers between updates, and distort the very iteration it is meant to guide. Preserve `runs: 1` in the website JSON. (The `performance.mjs` N=5 median rule for the `tsc`-vs-`ttsc` dashboard is separate and unchanged.)
- **Graph regression gate**: a graph instruction, schema, or engine change is not done until it is measured on both `common` and `dedicated` for every fixture and diffed cell-by-cell against the currently published `graph.json`. A cell that loses reduction, gains tool calls, or newly reads files is a regression that blocks merge until its trace explains the cause and the cause is fixed. Because the runs are N=1, you cannot average a bad cell away or wave it off as "inherent" (a prior model answered the same prompt in one call, so "inherent" is almost always wrong); one non-ideal cell means the change is unfinished, and it is cleared only by reading the trace, never by the token percentage. Validating one family, or the average, and declaring victory is how the last dedicated regression shipped unseen.
- **Graph retries**: publication keeps the default `--max-run-retries=4` so transient agent failures do not thin the median. N=1 optimization smoke runs may use `--max-run-retries=0` when the point is to expose a failure mode without spending tokens on repeated attempts.
- **Codex trace audit**: `graph.mjs` automatically writes `codex-trace-audit.json` beside the suite report whenever it runs Codex cells; run `audit-codex-traces.mjs` directly only to re-audit an existing run. The audit records every exposed assistant message, every shell/MCP call in timeline order, per-turn usage, and `reasoning_output_tokens`; hidden reasoning text is not emitted by Codex and must not be invented. It separates strict exact avoidable output such as duplicate MCP calls and legacy inline evidence text, measured graph-replaceable shell-output surface, candidate MCP overfetch surfaces such as broad graph traces, later-turn prompt replay exposure where Codex exposes multiple `turn.completed` events, zero-MCP or shell-fallback graph-arm traces, and an input ledger that compares usage input tokens with visible trace material. The ledger's unexplained input is an accounting gap, not proof of one hidden category. It reports observed, replacement lower-bound, candidate-ceiling, and observed replay-adjusted savings against the matching N=5 website baseline medians. Use `--compare=<before>,<after>` on audit JSON files, suite reports, or suite directories to compare optimization smoke runs by the same token/reasoning/tool/savings fields. Pass `--baseline=none` to disable baseline comparison.
- **PR result comment**: every benchmark result table reported in chat or committed to the website must also be recorded on the active PR. Maintain one sticky comment, not a new comment per run. Start it with `<!-- ttsc-benchmark-results -->`, include the latest table, the report/audit paths, and known invalid/missing cells, and update that same comment whenever a newer measurement supersedes it. If no PR exists yet, keep the table in the final report and mark the PR comment as pending; post/update it immediately after the PR exists.
- **Disk-cheap mode**: `--sequential` (env `TTSC_BENCH_SEQUENTIAL=1`) holds only one `(project, branch)` clone in `.work/` at a time: clone, measure, delete, next. Incompatible with `--setup-only` / `--no-setup`.
- **Publication host**: run publication sweeps on a quiet external host, then commit the resulting `website/public/benchmark/performance.json`. `merge-website.mjs` remains available when merging partial `report.json` files by cell id.

Publication sweep:

```bash
TTSC_BENCH_REQUIRE_QUIET=1 node experimental/benchmark/performance.mjs
```

After the sweep, inspect the diff against `website/public/benchmark/performance.json`: every fixture row present, row order preserved, host panel reflects the machine that produced the numbers.

## Changing `@ttsc/graph` while it is being benchmarked

### Compute the blast radius before you measure, not after

A tour is one payload, and every part of it is downstream of the ranking. Changing a seed score changes the seed order; the seed order changes which flows get traced; the flows change `nearby`, `tests` and the anchors. **A change that "only reorders seeds" changes the whole payload of every cell whose ranking it touches** — measuring the cell you were fixing and calling it done is how you fix Excalidraw and silently break TypeORM and RxJS.

So before spending a token: call the tour offline for all sixteen (repository × prompt family) cells, on the old build and on the new one, and diff the payloads. What is byte-identical cannot have changed; what moved is what you have to think about. This costs nothing and takes minutes.

### Any logic or text change means a full re-measurement of the `ttsc-graph` arm

The offline diff tells you what _the server_ did. It does not tell you what the _model_ does with it, and models are not deterministic: a Sonnet cell has swung from 81% saved to 8% on the same build. So a change to the tour, the runners, the MCP instructions or the tool description means re-measuring **every** `ttsc-graph` cell — four models × two families × eight repositories — not just the cells the diff moved. The baseline and comparator arms never touch this server and stand.

### The tool's own honesty is not a tuning knob

Two things the server says are load-bearing, and both must be _true_, not persuasive:

- **The audit** claims every fact was checked. It has to have been.
- **`next`** claims the result is complete (`answer`) or partial (`inspect`). A tour that covers two of the five stages a question named and still says `answer` is lying, and the models that drill after it are right to. Fix the claim, not the model.

Never buy tokens with an instruction that suppresses a legitimate follow-up. If the tour is incomplete, saying "answer and stop" only makes the answer worse — and a benchmark that rewards that is measuring the wrong thing.

### Fixing one cell is not a result

Three changes in one afternoon each fixed the cell they targeted and cost more elsewhere than they gained: a coverage-first seed cover put a stats panel in Excalidraw's tour, adding signatures to flow nodes grew the payload 22% and Sonnet answered with _more_ calls, and dropping `answerAnchors` as a "repeated coordinate" took away what the model used as its citation list — 7 calls became 19. **If a change surprises you, you did not understand what you changed.** State the predicted effect on every moved cell before measuring it, and roll back on the first surprise rather than patching the patch.

## Fixture repositories

Each fixture is a forked GitHub repo at `samchon/ttsc-benchmark-<name>`, plus `samchon/shopping-backend` for the plugin-heavy case. Every fixture carries four independent branches:

- **`legacy`**: upstream source with stock `tsc`, `eslint`, and `prettier`. TypeScript pinned to the Legacy TypeScript version shown on the dashboard host panel (currently `v6.0.3`).
- **`ttsc`**: same source as `legacy`, with `tsc` swapped for `ttsc` on the pinned TypeScript-Go `typescript@rc` runtime and the workspace configured to install `ttsc` from the tarball the runner packs.
- **`ttsc-lint`**: same source as `ttsc`, with `@ttsc/lint` folded into the compile pass so the `eslint` step is no longer invoked.
- **`graph`**: the branch the AI-token benchmark measures, branched from `ttsc`. It carries what the graph agent needs and the performance sweep must not see — above all a `tsconfig.graph.json` whose program includes the tests. Graph-only fixture edits go here, never to `ttsc`.

### Source parity

The three branches differ only in tooling, `package.json`, `tsconfig*.json`, `eslint.config.*`, `.prettierrc*`, lockfile, `ttsc` plugin descriptors. Application source is identical across `legacy`, `ttsc`, and `ttsc-lint`, so a cell delta reflects tool cost rather than workload drift.

### Lint and format scope is the tsconfig program

Across `legacy` and `ttsc-lint`, the lint and format cells process exactly the file set `tsconfig.json` compiles for that fixture. `eslint` and `@ttsc/lint` lint that set; `prettier --check` and `ttsc format` format that set.

Nothing inside the program is excluded; nothing outside it is targeted. Carve-outs via `--ignore-pattern`, `eslint.config` `ignores`, `.prettierignore`, or extra `files`/`exclude` entries are rejected because they make the cells incomparable.

### The graph program includes the tests

On the `graph` branch, each fixture's graph program is the sources **and** their tests — the program an editor's language server holds open, not the emit-only build program. The benchmark question asks which tests to read next, so a graph program without tests forces the agent to glob the repo for spec files and the token win collapses (vue: 31% with a test-less program, 82% and a single `tour` with the tests in it). Never point a graph cell at a build config that excludes tests, and never let a fixture's graph program drift back to `tsconfig.build.json`.

### Editing workflow

Edits go to the fixture repo on GitHub, not to the local clone. Setup runs `fetch + reset --hard` to the upstream branch tip on every run, so local changes in `.work/` disappear immediately.

Finish every fixture-branch edit by running the branch's own build, format, and lint commands (e.g. `pnpm build`, `prettier --write` or `ttsc format`, `eslint --fix`) until the tree is green, then commit and push. A half-finished tip pollutes every later run because the runner pulls upstream every setup.

READMEs and prose docs inside a fixture repo follow the same writing rules as ttsc itself. See AGENTS.md `## Maintenance 짠 Writing style` and `.codex/skills/documentation/SKILL.md 짠 READMEs`.

### Other rules

- **No tarball or built artifact in the fixture.** The runner packs and installs the local `ttsc` workspace during setup. The fixture repo must not carry pre-baked tarball paths, vendored `ttsc` builds, or stale `dist/` output.
- **Pin major TypeScript in lockstep.** When the Legacy TypeScript headline version bumps, update every fixture's `legacy` branch in the same release so the `tsc` baseline stays one major across the matrix.
- **Add fixtures by adding repos.** A new fixture means a new `samchon/ttsc-benchmark-<name>` repo carrying all three branches, plus a `PACKAGE_CONFIGS` entry at the top of `performance.mjs`. Multi-fixture tricks inside one repo are out of scope.
- **Removed comparisons stay removed.** The `type-fest` fixture was dropped deliberately. The `tsgo` rows (raw TypeScript-Go measured on the same `ttsc` clone for `build`/`noEmit`, cell ID `project:ttsc:tsgo:op:threading`) are a kept reference for launcher overhead, not eligible for the headline winner.
