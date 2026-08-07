---
name: benchmark/evidence
description: Defines how an @ttsc/evidence benchmark campaign is set up, launched under frozen inputs, run, supervised, recovered, and reported, from issue creation through pull-request completion. Use whenever operating, supervising, or reporting a benchmark run.
---

# Benchmark Operation

A campaign measures one coding engine building the same application twice: once with `@ttsc/evidence` and its guidance, once with neither. One subject and arm is a **cell**, one execution of a cell is a **run**, retained under `benchmarks/evidence/output/<subject>/codex/<arm>/runs/<run-id>/`.

Two perspectives, and they are never interchangeable.

- **[Measurement](measurement/SKILL.md)** — the benchmark's own view: how a cell is run, whether what it did still counts, and what may be published about it.
- **[Intervention](intervention/SKILL.md)** — your view as this repository's agent: what you may change, how you warn a cell, and how you recover one.

A rule written for the operator never binds a cell, and a cell's permitted edit is never yours to make.

## Standing Rules

- Change nothing but the arm.
- Report only what the record retained.
- Never repair a measured workspace.
- Warn before resume, resume before derive, derive before restart.

## Commands

Under `pnpm --filter @ttsc/benchmark-evidence`:

- `start` — launch, resume, or derive a run. [running.md](measurement/running.md), [recovery.md](intervention/recovery.md)
- `dashboard`, `audit-suspensions` — the live pull-request record. [dashboard.md](measurement/dashboard.md)
- `report` — the tracked `benchmarks/evidence/aggregate` artifacts. [aggregate.md](measurement/aggregate.md)
- `supervise` — apply a hand-written review verdict, in either arm. [plain-review.md](measurement/plain-review.md)
- `warn` — deliver an operator warning to a running cell. [warning.md](intervention/warning.md)
