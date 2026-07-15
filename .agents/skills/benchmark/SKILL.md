---
name: benchmark
description: Defines ttsc benchmark selection, fixture integrity, result reporting, and publication safeguards. Use before running or modifying a benchmark, changing a fixture, or publishing benchmark results; load the linked performance or graph procedure for the selected benchmark.
---

# Benchmark

This repository has two independent benchmark systems. Read the matching procedure in full before acting:

- [performance.md](performance.md): `ttsc + @ttsc/lint + ttsc format` versus `tsc + eslint + prettier`, including fixture branches and dashboard publication.
- [graph.md](graph.md): `@ttsc/graph` and graph-MCP comparators, including AI-agent runs, trace audits, regression gates, and graph fixtures.

Read both only when changing shared fixture infrastructure or a surface that affects both systems.

## Measurement Integrity

- Measure the real product. Do not add benchmark-only branches, fixture-name checks, expected-answer checks, monkey patches, or agent restrictions that would be wrong for an unmeasured repository.
- Give every comparator the setup its own documentation prescribes. Measuring a deliberately underconfigured competitor invalidates the comparison.
- Preserve the workload defined by the selected procedure. A faster result obtained by compiling, linting, formatting, indexing, or reading less input is not an optimization.
- Treat a surprising result as evidence that the change is not yet understood. Inspect the raw report or trace before accepting, explaining away, or patching around it.

## Fixture Changes

Benchmark setup resets local fixture clones to their upstream branch tips. Edit the fixture repository itself, not a clone under a benchmark work directory.

Finish every fixture change before pushing it:

1. Run that branch's own build, format, and lint commands until green.
2. Confirm the branch contains no tarball path, vendored ttsc build, stale `dist/`, or other generated benchmark input.
3. Commit and push the fixture branch. A half-finished upstream tip contaminates every later setup.

Fixture READMEs and prose follow AGENTS.md `## Maintenance` and the documentation skill.

## Report Results

Every result table reported in chat or committed to the website must be preserved for the active pull request. When the user has authorized PR updates under the pull-request skill, maintain one sticky comment beginning with `<!-- ttsc-benchmark-results -->`; update it with the latest table, report and audit paths, and known invalid or missing cells.

If no pull request exists or no update is authorized, keep the result in the final report and mark the comment as pending. Post it only after the user creates or authorizes updating the pull request.
