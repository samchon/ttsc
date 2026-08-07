# Running A Campaign

One cell is one native session driven through its arm's eight objectives. The operator freezes the inputs, launches, and watches; the runner prepares the workspace, sends every objective, and retains the record.

## Open The Campaign

1. Open the campaign issue.
2. Use the campaign branch in the repository's single worktree.
3. Push an empty campaign commit and open a draft pull request.
4. Record the authorized matrix, benchmark revision, engines, models, efforts, CLI versions, Evidence archive digest, and live dashboard in the pull-request body.
5. Assign one read-only reporting subagent to update that body every 5 minutes and immediately after a state change or anomaly.

## Launch A Cell

Freeze every input before launch, and never launch an unauthorized cell or rerun:

- **Identity** — subject, arm, engine, model, effort.
- **Material** — requirements, template, instructions, package archive, browser server version.
- **Version** — CLI version, benchmark revision.

[intervention/boundary.md](../intervention/boundary.md) owns what may change and when.

The runner reads the benchmark revision from the repository's `HEAD` and refuses to launch while anything is uncommitted or untracked, so commit or stash first.

The browser server adds three host conditions, and none of them is checked before model use:

- **A browser channel it can drive.** The server uses one installed on the machine rather than the workspace's own Playwright, so the host needs it and a cohort spread over days can drive two builds of it. Pin the channel on the machine and record which one, the way the model and effort are recorded.
- **A display, or an explicitly headless server.** It runs headed by default, so a full matrix opens one window per cell and a headless host launches nothing.
- **A warm package cache, or patience on the first launch.** The first cell on a machine installs the server and its Playwright from the registry inside the handshake window, which `EvidenceBenchmarkRuntime.BROWSER_MCP_STARTUP_TIMEOUT_SECONDS` widens from Codex's ten seconds to three hundred.

A fourth condition is not the host's: `--config` merges into the operator's own `~/.codex/config.toml`, which the runner does not isolate. Whatever MCP servers that file already declares reach every cell, and an entry it declares under the same name merges field by field with the runner's. Read it before a cohort and record what it contained, because the process record shows only the arguments the runner added.

Unless the user names something else, every campaign runs the same engine, model, and effort. Only the subject and arm vary:

```bash
pnpm --filter @ttsc/benchmark-evidence start codex <subject> <evidence|plain> gpt-5.6-luna high
```

- **`codex`** is the only engine the command line accepts.
- **`gpt-5.6-luna`** is the default model. `report` also prices `gpt-5.6-terra` and `gpt-5.6-sol`, and an unpriced string still launches and is measured but publishes no USD cost.
- **`high`** is the default effort. The parser also accepts `low`, `medium`, `xhigh`, `max`, and `ultra`.
- **The subject** names a directory under `benchmarks/evidence/requirements/`, and `EvidenceBenchmarkRuntime.assign` is the authority on which ones a cell may take. There are five, below.

The model and effort are defaults, not a menu you pick from. Change either only when the user names it, and record what they authorized in the pull-request body. Cost is why the default is what it is, and a cell run at another model or effort is not comparable with a cohort that used these.

Never run two commands against the same run ID at once. A resume reuses the run ID by design, so the rule is about concurrency, not about a second invocation.

A launch that fails before native work does not consume the authorized cell, as long as its identity and frozen inputs are unchanged. Two such failures are ordinary: an unclean repository, and an occupied port from the cell's own block.

A third fails later and reads differently. The browser server is declared `required`, so a handshake it misses aborts the thread rather than dropping the tool, and that happens after the workspace is prepared and installed, surfacing as an `interrupted` run like any other stopped cell. Read the stage log before diagnosing it as a dead model process: `codex doctor` reports an unresolvable server command in a moment and costs nothing.

### Subjects

| subject    | what it is                                               |
| ---------- | -------------------------------------------------------- |
| `todo`     | the smallest corpus, 19 H2 and 54 H3 sections            |
| `reddit`   | 44 H2, 150 H3                                            |
| `shopping` | 73 H2, 354 H3                                            |
| `erp`      | the largest, 253 H2 and 1234 H3 across six documents     |
| `todo2`    | a byte-identical copy of `todo`, with its own port block |

`todo2` exists so one subject can be run twice under identical requirements. A cohort's cells are one run each, so a repeat draw is the only way to separate what a rule selects for from what one model did once, and the requirement corpus is frozen, so a duplicate cannot be created on demand. It arrived with the vendoring from `samchon/lint-plugin-evidence`.

It is not part of the default matrix. Running it is an explicit authorization like any other cell, recorded in the pull-request body with the rest.

### Port Blocks

Every cell owns a disjoint block of four ports from base 46000, so two cells never contend. The runner assigns them before any model use and refuses to launch when one is occupied.

| subject  | arm      | api   | swagger | vite  | playwright |
| -------- | -------- | ----- | ------- | ----- | ---------- |
| todo     | evidence | 46000 | 46001   | 46002 | 46003      |
| todo     | plain    | 46010 | 46011   | 46012 | 46013      |
| reddit   | evidence | 46020 | 46021   | 46022 | 46023      |
| reddit   | plain    | 46030 | 46031   | 46032 | 46033      |
| shopping | evidence | 46040 | 46041   | 46042 | 46043      |
| shopping | plain    | 46050 | 46051   | 46052 | 46053      |
| erp      | evidence | 46060 | 46061   | 46062 | 46063      |
| erp      | plain    | 46070 | 46071   | 46072 | 46073      |
| todo2    | evidence | 46080 | 46081   | 46082 | 46083      |
| todo2    | plain    | 46090 | 46091   | 46092 | 46093      |

Every subject `EvidenceBenchmarkRuntime.assign` accepts has a row here. A subject added to that function and not to this table has no block a recovery can free, so add both together.

The block reaches the workspace as `API_PORT`, `SWAGGER_PORT`, `VITE_DEV_PORT`, `VITE_API_HOST`, and `PLAYWRIGHT_TEST_PORT`, so the cell's own commands and tests inherit it without being told.

What contends is never another cell — it is a cell and its own past. [intervention/recovery.md](../intervention/recovery.md) owns the orphan case.

### Stop After Backend Start

`--stop-after-backend-start` ends the run once `backend-start` completes and its durable checkpoint exists, retaining status `checkpointed`:

```bash
pnpm --filter @ttsc/benchmark-evidence start codex <subject> <evidence|plain> gpt-5.6-luna high --stop-after-backend-start
```

That run is finished. It never resumes, and it continues only as a checkpoint-derived run, which is why the flag exists: it seeds a reusable `backend-start` for downstream instruction work without spending the rest of a cell. It cannot be combined with `--from-backend-start`, and the runner refuses the stop if the checkpoint is missing. [intervention/recovery.md](../intervention/recovery.md) owns the derivation.

## What The Runner Prepares

Each cell gets a new ignored workspace, prepared before any model use:

1. Copy `benchmarks/evidence/template/base` and render its variables.
2. Apply `benchmarks/evidence/template/<arm>` over it. Both arms get an overlay — each splices its own `AGENTS.md` and review skill — but only Evidence adds the package, claims, tags, and graph guidance.
3. Copy `benchmarks/evidence/requirements/<subject>/` byte-for-byte into the workspace's `docs/analysis/`.
4. For Evidence only, install the locally packed Evidence archive and pin its SHA-256 to the cell. Plain never reads or installs it.
5. Run `pnpm install`.
6. Initialize the workspace as a Git repository and commit the prepared baseline.

Instructions are never copied into the workspace. The runner reads each Markdown file from this repository when its objective starts, and records the exact text it sent.

### Share One Archive Across Parallel Evidence Cells

A cell with no `EVIDENCE_BENCHMARK_ARCHIVE` in its environment packs its own Evidence tarball, so parallel Evidence cells would each measure a separately built artifact. Pack once and export the path, and every cell copies that one file and pins its digest:

```bash
pnpm --dir packages/evidence pack --out /tmp/evidence.tgz
export EVIDENCE_BENCHMARK_ARCHIVE=/tmp/evidence.tgz
```

That is the same `pack --out` the runner would have run per cell, hoisted to once per campaign.

The runner strips the variable from every child environment, so a measured cell never sees it.

## The Objective Sequence

One native session receives its arm's frozen base sequence, read from `benchmarks/evidence/instructions/<arm>/<scope>/<step>.md`:

`backend-start` → `backend-review` → `backend-final` → `frontend-start` → `frontend-review` → `frontend-final` → `overall-review` → `overall-final`

`EvidenceBenchmarkInstruction.entries()` is the only authority on that sequence.

The runner joins each objective with the same arm's `instructions/<arm>/continue.md` once, and a Plain reminder or Final also carries its own scope's Review instruction quoted beneath it. An operator warning is the one exception: outside a Plain reminder or Final it replaces the continuation rather than joining it, which keeps the objective inside the 4000 characters Codex accepts however long the warning runs.

The arms share no instruction file. They do share sentences, and every one is deliberate: a gate over a capability held constant reads the same to both arms, and a supplementation asserts the same rejection in both, because a difference in those words would be a difference in what is measured rather than in what is being measured. Do not add operator prose.

Every session is attached to a pinned Playwright MCP server through the same argument list, which has no arm branch. It is a frozen material input like the template: `EvidenceBenchmarkRuntime.BROWSER_MCP_SPECIFIER` names the version, `required=true` makes a server that misses its handshake a launch failure rather than a silently absent tool, and the retained process record carries the arguments.

Only Plain stops at a Review boundary; Evidence runs the eight objectives without stopping. [plain-review.md](plain-review.md) owns that loop.

## What Is Retained

Every run directory holds the record the campaign is reported from:

- `state.json` — cell identity, frozen inputs, instruction plan and cursor, status, thread token usage, checkpoints, processes, operator warnings, and review history.
- `events.jsonl` — the complete native stream with observation and process-relative times.
- `<stage>.log` — one file per objective in the run root, named after the Goal that owned the thread when the chunk arrived: `backend-start.log`, `backend-remind-3.log`, `overall-final.log`. Reading them in objective order reproduces the native stream exactly, and a resumed run appends to the same file.
- `supervision/` — the exact bytes of every applied decision: `<NN>-<objective>-warning.json` for an operator warning, `<NN>-<scope>-<attempt>-verdict.json` for a review verdict.
- `inspection/` — every inspecting-thread attempt: prompt, response schema, event stream, standard error, and final message.

Stage names in the logs and on the dashboard are one vocabulary.

Setup time stays separate from model-process time, and the record carries no build, lint, quality, or completion verdict.

## Supervise

Observe every active cell at least every 30 seconds:

- `state.json`, and benchmark and native process liveness.
- The recency of `events.jsonl` and of the current stage's `<stage>.log`.
- The frozen configuration files in every cell. The reporting subagent re-reads them on every cycle and reports a hit as a material change, quoting the diff it just read. [integrity.md](integrity.md) owns what is a hit and what is the cell doing its job.

Correct the dashboard on any disagreement immediately, without waiting for its 5-minute interval.

Take anything else to [intervention/SKILL.md](../intervention/SKILL.md), and diagnose before touching it.
