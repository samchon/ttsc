# Topic: `@ttsc/lint` Full Audit — Source, Tests, Docs, and Missing Rules

Date opened: 2026-05-28
Workflow: AGENTS.md §4.3 Research Review Rounds
Lead: Claude (Opus 4.7, 1M context)
Scope: `packages/lint/` (all subdirs) + lint guides under `website/src/content/docs/lint/`

## Goal

Strengthen `@ttsc/lint` end-to-end via repeated review rounds. Each round must surface concrete, verifiable improvements in any of:

1. **Rule logic** — incorrect AST handling, false positives, false negatives, missing options.
2. **Test quality** — bogus assertions, redundant cases, missing branches, fragile fixtures, hand-copied baselines that don't actually exercise the rule.
3. **Algorithmic efficiency** — quadratic or worse loops, redundant traversals, repeated checker calls, alloc-heavy hot paths.
4. **Public API / src TypeScript** — bugs in command/config/engine/format/printer/registry layers; perf issues; dead branches.
5. **Documentation** — README claims that no longer match code; wrong examples; broken or stale website guides.
6. **Missing rules** — per family, rules that are part of the upstream ESLint plugin but not yet implemented here.

## Process

For each round:
1. Six fresh agents each build a personal knowledge base under `agent-N-<slug>/` (no shared writing).
2. Three live discussion transcripts `round1.md`, `round2.md`, `round3.md` — lead writes statements in speaking order; team agents re-read before each turn.
3. Each agent files concrete proposals in `proposals.md`.
4. Lead writes `lead-validation.md` verifying every proposal against the current codebase and applies only the sound, relevant ones.
5. Next round → six new agents, repeat. Stop when no proposal survives validation.

## Round index

- `review-round-1/` — in progress
