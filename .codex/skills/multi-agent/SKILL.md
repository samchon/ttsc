---
name: multi-agent
description: Self-Review, Review Cycle, Discussion, and Research Review Round workflows. Read the Exhaustive rounds and Stop condition rules before any review round (solo or team); read the Briefing subagents rule before delegating to any subagent; read in full when the user asks for a named mode.
---

# Multi-Agent Workflows

Use only when the user explicitly asks for one of the named modes, Self-Review, Review Cycle, Discussion, or Research Review Round. Each mode composes the shared building blocks below; do not invent unnamed combinations.

## Non-negotiable review law

Every review mode (solo Self-Review or a team) obeys two rules that override any urge to finish. Violating either is the failure mode to design against, not a judgment call.

- **Each round is exhaustive.** A round is a complete, from-scratch inspection of the ENTIRE change — every changed file and every hunk read in full — plus active latent-risk detection that reaches BEYOND the diff into the code paths, tests, CI, and docs the change can break. Never split a round across "parts not yet seen," never lean on an earlier round's reading, never sample. A round that skips any changed file, or only re-checks what it touched last time, is not a round.
- **Rounds are unlimited.** Any round that applies even one improvement mandates a further full round. Stop only after one complete exhaustive round finds nothing to improve. Never declare convergence from a partial or incremental pass, never stop because the change "looks done," and never announce that review is over while an improvement from the current round is still unaddressed.

## Building Blocks

### Six-agent team

Form a team of six agents. For looped modes, replace the team with six different agents at the start of each round or cycle.

### Lead role

The lead agent coordinates the team. In modes that produce proposals, the lead rechecks every proposal against the codebase and applies only changes that are technically sound and relevant. In modes that produce transcripts, the lead moderates and scribes, writing each statement in speaking order, recording the live discussion (not a retrospective summary), and not narrowing the topic unless the user did.

### Briefing subagents

Subagents start blind: they carry no conversation history and do not auto-load `AGENTS.md` or the skills. Give each a self-contained brief with the objective, the constraints, the context it needs, the output format, and which `AGENTS.md` sections (at least `## Attitude`) and `.codex/skills/*/SKILL.md` to read. State the evidence and the constraints, not a pre-chosen answer; a leading hypothesis steers the agent to a shallow fix. A subagent runs its brief directly and does not re-delegate.

### Topic directory

Create `.discussions/<topic>/` with a short filesystem-safe topic name. Do not delete or overwrite existing discussion directories unless the user explicitly requests it.

### Per-agent knowledge base

Each agent creates a personal subdirectory under the topic directory and continuously maintains its own wiki-style knowledge base there. Between turns, agents read the updated transcript and each other's statements, keep researching, revise their knowledge bases, and prepare notes.

### Three transcript rounds

Run three unrestricted rounds recorded as `round1.md`, `round2.md`, and `round3.md`. Each round has a one-hour budget.

### Stop condition for looped modes

Governed by the unlimited-rounds law above: continue while any round applies at least one verified improvement; stop only after a complete exhaustive round accepts none. Applies identically to solo Self-Review and team modes.

## Modes

### Self-Review

The solo form of review — one reviewer, no team — when the user asks for self-review (bounded or unlimited). Same law as every mode: exhaustive rounds, unlimited until a clean round.

1. Read the ENTIRE change in full (every changed file and hunk) and hunt latent risks beyond the diff, working a fixed checklist each round: correctness and edge cases (null/undefined, off-by-one, boundaries), cross-platform (Windows/POSIX paths, shells), concurrency, data loss, security, cache/state invariants, test correctness AND hygiene (determinism, isolation, no real-environment side effects), CI and harness correctness, docs accuracy, and migration/back-compat.
2. Apply every sound fix and commit it, then restart at step 1 as a fresh full round.
3. Apply the stop condition: end only on a complete exhaustive round that finds nothing.

### Review Cycle

Direct review of changed source, docs, and tests. No topic directory, no transcripts.

1. Form the team. Each agent reads the changed source/docs/tests IN FULL (the whole change, per the exhaustive-rounds law) and proposes improvements plus latent risks beyond the diff.
2. Lead validates and applies surviving proposals.
3. Start the next cycle with a fresh team. Apply the stop condition.

### Discussion

Open-ended topic exploration without changing code. No proposals, no validation.

1. Create the topic directory. Form the team; each builds its knowledge base.
2. Run the three transcript rounds directly under the topic directory.
3. After `round3.md`, the lead writes agreed conclusions and major open points into `summary.md`, reports to the user, and waits.

### Research Review Round

Review that needs shared research before individual proposals, discussion KB workflow plus the validation loop.

1. Create the topic directory. Each round lives in its own `review-round-N/` subdirectory containing fresh agents' KB folders, `round1.md`, `round2.md`, `round3.md`, `proposals.md`, and `lead-validation.md`.
2. In each round: agents build KBs from changed source/docs/tests plus relevant research → three transcript rounds → each agent submits its own concrete proposals (no consensus required) → lead validates and applies surviving ones.
3. Fresh team next round; apply the stop condition.
