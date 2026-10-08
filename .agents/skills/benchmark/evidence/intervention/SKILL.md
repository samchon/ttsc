---
name: benchmark/evidence/intervention
description: "Defines operator intervention in an Evidence benchmark: frozen boundaries, warnings, diagnosis and recovery. Use before correcting a benchmark defect, warning a cell, resuming or deriving a run, or cancelling a campaign; a cell's measurement validity belongs to benchmark/evidence/measurement."
---

# Intervention

This is your view as this repository's agent: what you may change, how you warn a cell, and how you recover one. Whether a cell's own edit still counts is a measurement question, and [measurement/integrity.md](../measurement/integrity.md) owns it.

## [Boundary](boundary.md)

Protected inputs, explicit authorization and the repository locations where defects may be corrected.

## [Warning](warning.md)

The operator's permitted message channel into a running cell.

## [Recovery](recovery.md)

Triage, process diagnosis, port ownership, exact resume, checkpoint derivation and cancellation.
