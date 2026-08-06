# Boundary

This is what **you**, operating the campaign from this repository, may not change. A cell's limits are a different contract entirely, written in the cell's own workspace, and [measurement/integrity.md](../measurement/integrity.md) owns it. Never apply a rule from this page to a cell.

## Never, Whatever You Found

Under `benchmarks/evidence/template/**`, in either arm, at any nesting level:

- **`tsconfig.json`** — any file, any property.
- **`lint.config.ts`** — any file, any property, including a claim, a selector, a severity, or a `disabled`.
- **`package.json`** — `main`, `exports`, and `publishConfig`. Adding a top-level `types` or a new `exports` subpath is equally forbidden.

Creating or deleting one of those files counts as changing it.

Three more:

- **A measured workspace.** What a cell did to its own workspace is the measurement.
- **`benchmarks/evidence/requirements/**`.\*\* Opaque, authoritative bytes: never edit, rename, add, delete, normalize, summarize, validate, or challenge them.
- **The cell's own reasoning.** Do not prompt the measured agent, inject advice, weaken a gate, or hard-code a subject answer, and never expose Evidence material to Plain. A cell's questions and partial reports do not invite operator input; its continuation instruction already tells it to finish on its own.

## Why The Three Files

They decide what each Program contains and where a package resolves to, so together they decide what every evidence population selects from. A change no one asked for voids the measurement instead of failing it: an empty population demands nothing, and a claim that reaches that state reports full coverage while checking nothing.

That is also why the prohibition is absolute rather than a default you may weigh against a deadline. A voided cohort looks exactly like a healthy one.

## If You Believe One Must Change

Ask the user. Every time, whatever the reason, however obvious the fix looks.

Do not repair a file you believe is broken, do not adapt one to a symptom you are chasing, and do not add an exclusion to silence a diagnostic. These are the user's files.

Report what you observed, naming the file and line, and then stop and wait for an explicit instruction that names that file. This is the one place in the campaign where picking the sensible default is not yours to do.

## Where A Defect May Be Corrected

Everything else in this repository is fixable, and where the fix lands decides when you may commit it.

| What you fix | Who reads it | When you may edit it |
| --- | --- | --- |
| `benchmarks/evidence/src/**` | A benchmark process, at start | Any time, with one exception below. Commit first: a resume requires a clean revision descending from the cell's frozen `benchmarkRevision`, and the runner retains the correction as that process's `runnerRevision`. |
| `EvidenceBenchmarkRuntime.BROWSER_MCP_SPECIFIER` | Every session, at every launch and resume | Never while a cohort is open. It is a frozen material input that happens to live in editable source: nothing compares it across processes and no resume refuses a change, so an edit mid-cohort is drift with no record of itself. |
| `benchmarks/evidence/instructions/**` | A running cell, at its next objective | Not while a cell that will reach it is alive. Stop and preserve the cohort first. |
| `benchmarks/evidence/template/**`, except the three files above | Workspace preparation only | Any time. It reaches future launches only, never a prepared workspace. |
| The three files above | Every evidence population in every cell | Never without the user's explicit instruction. |
| `benchmarks/evidence/requirements/**` | Workspace preparation, byte-for-byte | Never. |

Report the defect immediately, and commit and push the verified correction in the campaign pull request.

A defect confined to an instruction after `backend-start` is corrected by [deriving a new run](recovery.md) from that checkpoint, never by restarting the cell.
