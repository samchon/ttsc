---
name: benchmark/evidence
description: Defines how an @ttsc/evidence benchmark campaign is set up, launched under frozen inputs, run, supervised, recovered, and reported, from issue creation through pull-request completion. Use whenever operating, supervising, or reporting an evidence benchmark run.
---

# Benchmark Operation

A campaign measures one coding engine building the same application twice: once with `@ttsc/evidence` and its guidance, once with neither. One subject and arm is a **cell**, one execution of a cell is a **run**, retained under `benchmarks/evidence/output/<subject>/codex/<arm>/runs/<run-id>/`.

Read the [benchmark README](../../../../benchmarks/evidence/README.md) for commands, workspace preparation and retained records. The two perspectives below have separate owners: a rule for the operator never binds a cell, and a cell's permitted edit never authorizes the operator to make it.

## [Measurement](measurement/SKILL.md)

Campaign launch and supervision, cell validity, Plain review, live dashboard and published aggregates.

## [Intervention](intervention/SKILL.md)

Operator boundaries, warnings, diagnosis and recovery of the retained run.
