# Evidence benchmark

This benchmark compares the same coding engine building the same application with and without `@ttsc/evidence`. Both arms receive the same requirements, shared template, base instruction order, engine, model, and effort. Only the Evidence arm receives the package, its claims and tags, and Evidence-specific guidance.

The runner prepares an isolated workspace, drives the prescribed instructions in one native session, and retains the native execution record. It does not validate requirements, judge the generated application, or repair a measured workspace.

Operating a campaign — authorization, supervision, warnings, recovery, and reporting — belongs to `.agents/skills/benchmark/`. This file describes what the runner itself does.

## Workspace preparation

Each cell uses a new ignored workspace.

1. Copy the shared base template into the workspace and render its variables.
2. Apply the arm overlay. Both arms splice their own `AGENTS.md` and review skill; only Evidence adds the package, claims, tags, and graph guidance.
3. Copy the selected `benchmarks/evidence/requirements/<subject>/` directory exactly into `docs/analysis/`. Treat its paths and bytes as opaque input.
4. Add the locally packed Evidence `.tgz` only for the Evidence arm, and record its SHA-256 on the cell.
5. Run `pnpm install`.
6. Initialize the workspace as a Git repository and commit the prepared baseline.

The runner assigns each subject and arm a stable, disjoint API, Swagger, Vite development, and Playwright port block from base 46000, and exports it to the workspace as `API_PORT`, `SWAGGER_PORT`, `VITE_DEV_PORT`, `VITE_API_HOST`, and `PLAYWRIGHT_TEST_PORT`. It refuses a fresh launch or resume when any assigned port is already occupied.

Instructions remain in the benchmark repository. The runner reads each Markdown file when starting its objective and records the exact text it sends; it does not copy instructions into the generated workspace.

## Run

Start a new cell from the repository root:

```bash
pnpm --filter @ttsc/benchmark-evidence start codex <subject> <evidence|plain> <model> <effort> [run-id]
```

Omit `run-id` to create a cell under `benchmarks/evidence/output/<subject>/<engine>/<arm>/runs/<run-id>/`. Pass an existing run ID only to resume that exact engine, subject, arm, model, effort, workspace, and session; the runner compares all of them against the retained cell and refuses on any difference.

`<subject>` names a directory under `benchmarks/evidence/requirements/`, and `EvidenceBenchmarkRuntime.assign` decides which ones are launchable and what port block each one owns. There are five: `todo`, `reddit`, `shopping`, `erp`, and `todo2`. The last is a byte-identical copy of `todo` that exists so one subject can be run twice under identical requirements, which is the only way to take a repeat draw from a corpus that is frozen.

The launcher also reads the repository `HEAD` as the campaign's benchmark revision and refuses to start while anything is uncommitted or untracked.

Three options change what a run does:

- `--stop-after-backend-start` ends the run once `backend-start` completes and its durable checkpoint exists, retaining status `checkpointed`. That run never resumes; it continues only as a derived run.
- `--from-backend-start <source-run-id>` starts a new run from a retained checkpoint, below.
- `--review-ledger` makes the Plain backend review runner-owned, below. It requires a detached checkpoint thread, so it accompanies a run ID or a derivation.

After `backend-start` completes, the runner stores a workspace and native-turn checkpoint before starting `backend-review`. If a later instruction proves defective, create a new run from that point:

```bash
pnpm --filter @ttsc/benchmark-evidence start codex <subject> <evidence|plain> <model> <effort> --from-backend-start <source-run-id>
```

The derived run verifies the retained cell and exact completed `backend-start` boundary, restores that workspace and reinstalls its dependencies, reapplies the current non-product instruction surface — `AGENTS.md` and `.agents/` — forks the native thread through the retained terminal turn, and reads the current downstream instructions. An explicit operator launch does not reject the checkpoint because repository inputs changed after it was created.

When launching Evidence cells concurrently, pack once and export `EVIDENCE_BENCHMARK_ARCHIVE`; every Evidence cell then copies that one file and records its SHA-256. Without the variable, a standalone Evidence cell packs its own archive. The runner strips the variable from every child environment.

## Review boundaries

Both arms stop for a verdict, after every Backend, Frontend, and Overall Review and again after each supplementation Goal, retaining status `awaiting-review-verdict`. An arm nobody checks has the compiler as its only gate, and the compiler proves that a citation resolves rather than that it is true, so inspecting one arm and not the other would have made the arms differ in two things instead of one.

The runner produces the verdict itself: at the boundary it spawns a fresh Codex thread on the cell's own model and effort, which reads the attempt's stage log and the measured workspace and returns a decision. The questions differ by arm, because a Plain review is a reading loop and an Evidence review inspects its own acknowledgements. Three attempts are permitted at one boundary, and a resume retries a failed one. Only after the third failure does the run require a hand-written verdict:

```bash
pnpm --filter @ttsc/benchmark-evidence supervise <subject> <run-id> <verdict.json>
```

A verdict carries `decision` and `rationale` only; the runner refuses one carrying `feedback`, so no verdict text ever reaches the cell. A failing scope receives the identical prescribed reminder, and four supplementation attempts are permitted before the run retains `quality-failed`. `EvidenceBenchmarkInstruction.REVIEW_SUPPLEMENT_LIMIT` owns that bound and its own comment records why it is four.

`--review-ledger` additionally makes the backend review loop mechanically provable. During `backend-review` the runner holds the cell's sandbox read-only and injects the only tools that receive review credit, then refuses to complete `backend-review` or `backend-final` unless a runner-owned round ended dry and the workspace manifest still hashes to what that round read. It does not replace the verdict boundary, which still fires.

An operator warning is a separate channel with its own command:

```bash
pnpm --filter @ttsc/benchmark-evidence warn <subject> <evidence|plain> <run-id> <warning.json>
```

The cell must be stopped first. The runner refuses feedback that names the machinery outside the workspace, because a cell told it is being measured stops being a measurement.

## Publishable reports

Raw run records and measured workspaces stay under the ignored `benchmarks/evidence/output/` directory. Generate the tracked latest-run aggregate and comparison charts with:

```bash
pnpm --filter @ttsc/benchmark-evidence audit-suspensions
pnpm --filter @ttsc/benchmark-evidence report
```

The suspension audit compares each latest run with Windows Kernel-Power disconnected-standby intervals. It records an interval in the run's `suspensions.json` only when retained events prove the same native process existed on both sides and emitted nothing during the interval. Reports exclude those verified intervals from total and stage work time without modifying `state.json`. The audit is Windows-only and throws elsewhere rather than reporting zero intervals.

The command writes `benchmarks/evidence/aggregate/summary.json` and stable per-cell JSON under `benchmarks/evidence/aggregate/cells/<model>/<subject>/<arm>.json`, then draws `summary.svg` and one `<model>-<subject>.svg` per subject into `website/public/benchmark/evidence/`, where the site serves them. Every artifact renders or copies values from the same retained aggregate without recalculating them. An empty collection is refused rather than published, so a checkout without run records cannot replace the tracked measurement with nothing.

`summary.json` records an `origin`, the repository whose run records the collection read, taken from that repository's manifest and reduced to `owner/name`. Each cell carries the `benchmarkRevision` its launcher read from `HEAD`, and a bare SHA resolves nowhere on its own, so the origin is what separates a cohort measured here from one vendored in. An aggregate published before the field existed does not carry one and is not back-filled, which is the tracked aggregate's state today.

`coverage.json` is the one aggregate artifact nothing in this repository writes; it is counted by hand from a completed workspace. Its `source.origin` names the repository it was counted in, and each row names the run it was counted from beside the cell it describes:

```json
{
  "source": { "origin": "samchon/ttsc" },
  "cells": [
    {
      "model": "gpt-5.6-luna",
      "subject": "todo",
      "arm": "plain",
      "runId": "2a44f046-1acb-4607-b826-30a3e7fa784b",
      "coverage": { "score": 0.42, "measured": true }
    }
  ]
}
```

`report` refuses to publish over a file counted in another repository, over a row naming a run the cohort is not publishing, or over a row naming none. Otherwise a second cohort's spend would be drawn beside the first cohort's coverage. The tracked file predates the `runId` field and was counted upstream, so it is refused until it is recounted or removed. A cohort with no coverage at all publishes normally.

The charts redraw from the tracked aggregate alone, with no run records present:

```bash
pnpm --filter @ttsc/benchmark-evidence charts
```

The report reconstructs OpenRouter API-equivalent USD cost from each native request's token categories and context tier, then publishes it only when those requests exactly match the retained total.

Pass repeated `--run-id <run-id>` arguments to both commands to audit and publish an explicit historical cohort instead of the latest launched cell for each subject and arm.

The live campaign dashboard is a separate command that takes no arguments and always renders the latest launched run of each cell. It cannot be pointed at a historical cohort, and it refuses an argument rather than ignoring one, so a run ID appended to all three commands fails here instead of labelling the live cohort as a historical one:

```bash
pnpm --filter @ttsc/benchmark-evidence dashboard
```

## Instruction sequence

One native session receives its arm-owned base sequence of eight objectives, in order:

| Step | Evidence | Plain |
| --- | --- | --- |
| Backend start | `instructions/evidence/backend/start.md` | `instructions/plain/backend/start.md` |
| Backend review | `instructions/evidence/backend/review.md` | `instructions/plain/backend/review.md` |
| Backend final | `instructions/evidence/backend/final.md` | `instructions/plain/backend/final.md` |
| Frontend start | `instructions/evidence/frontend/start.md` | `instructions/plain/frontend/start.md` |
| Frontend review | `instructions/evidence/frontend/review.md` | `instructions/plain/frontend/review.md` |
| Frontend final | `instructions/evidence/frontend/final.md` | `instructions/plain/frontend/final.md` |
| Overall review | `instructions/evidence/overall/review.md` | `instructions/plain/overall/review.md` |
| Overall final | `instructions/evidence/overall/final.md` | `instructions/plain/overall/final.md` |

The sequence is adaptive, not fixed. A failing review verdict inserts that scope's `instructions/<arm>/<scope>/remind.md` as a supplementation Goal named `<scope>-remind-<attempt>`, and a passing verdict advances straight to that scope's Final. `EvidenceBenchmarkInstruction.entries()` owns the base sequence; runs retained before the adaptive plan reconstruct their fixed eleven-step order through `legacyPlan()`.

For each Plain Reminder and Final step, the runner appends the matching Review instruction as a Markdown blockquote at the bottom of the prescribed instruction. It then combines the prescribed instruction and that arm's `instructions/<arm>/continue.md` once as the objective. An operator warning replaces the continuation instead of joining it, except on a Plain Reminder or Final, where it is inserted above the quoted Review. The arms share no instruction file. The sentences they do share are the gates over a capability held constant and the supplementation's own rejection, which read the same to both arms on purpose.

Every session is attached to a pinned Playwright MCP server, identically for both arms, so a cell can drive its own application in a browser. `EvidenceBenchmarkRuntime.BROWSER_MCP_SPECIFIER` names the exact version, the server is declared `required` so a failed handshake is a launch failure rather than a silently missing tool, and the retained process record carries the arguments that attached it. The server drives a browser channel installed on the host rather than the workspace's own Playwright, and `--config` merges into the operator's `~/.codex/config.toml`, so both belong to the launch conditions `.agents/skills/benchmark/evidence/measurement/running.md` states.

Codex receives each objective as a native Goal in one app-server thread. It advances after Goal completion, terminal-turn completion, and an idle thread.

Engine completion is recorded execution behavior, not a quality verdict.

## Retained record

The runner retains facts in delivery order:

- the exact prescribed, continuation, and combined user text;
- complete native stdin, stdout, and stderr in `events.jsonl` and in one `<stage>.log` per objective, with observation and process-relative times;
- subject, engine, arm, benchmark Git revision, Evidence artifact SHA-256 when applicable, requested model, effort, CLI version, session, instruction, and process identity;
- the current instruction cursor and engine-specific terminal checkpoints;
- native token categories, process elapsed time, exit code, and signal;
- the durable `backend-start` workspace and native-turn checkpoint, plus source lineage and inherited timing for a derived run;
- every applied decision under `supervision/`, as the exact submitted bytes of each warning and verdict;
- every inspecting-thread attempt under `inspection/`, including its prompt, response schema, event stream, standard error, and final message.

Setup time remains separate from model-process time. The retained record does not add build, lint, requirement, graph, quality, publication, or completion verdicts.

## Interruption and review

The operator does not add prose or implementation advice during a cell. The shared continuation text already instructs the measured agent to finish autonomously.

After an abnormal interruption, preserve the run and inspect its retained state. Codex may continue an exact retained Goal.

Review every completed workspace without changing it. Record application defects separately from evidence that a template, instruction, or runner misdirected the agent. Do not change frozen inputs while any cell in the same comparison cohort is active.
