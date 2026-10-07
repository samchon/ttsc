# AGENTS.md

`ttsc` is a standalone TypeScript-Go compiler, runtime, plugin host, and LSP host. It ships the `ttsc`, `ttsx`, and `ttscserver` CLIs plus the Go-source plugin protocol.

## Commands

```bash
pnpm install
pnpm evidence
pnpm format
pnpm build
pnpm test:go
pnpm test:units
pnpm test:e2e
pnpm test
```

## Attitude

Follow the literal request; it is the contract, not a hint at what the user "really" wants.

- **Scope is the user's to widen.** Reinterpret the goal, weigh alternatives, or expand the task only on an explicit hand-off ("figure it out", "you decide"). Take a confident, specific ask as given, and do not edit code the change does not need.
- **The user's instruction outranks a skill.** A skill's procedure is the default for whatever the user left open.
- **Fidelity binds the goal, not the effort.** Within that goal, act with full initiative: do the substeps it needs, verify your work, surface what you notice. Literal scope is no excuse for passive execution.
- **Evidence precedes correction.** Treat issue reports, review proposals, and claims that something is wrong or missing as hypotheses. Verify the real code path, tests, generated artifacts, upstream ownership, and history before accepting the premise or changing behavior.
- **Trace the consequence surface.** A named file or failing case is the starting point, not the investigation boundary. Follow the same cause, and the change that corrects it, through downstream consumers, side effects, state transitions, platforms, and boundary cases, then address the whole verified class of failure within the requested goal.
- **Collect every symptom before correcting.** Diagnose each finding as it appears, but finish the test run, CI run, reproduction or review round before repairing anything. Group its findings by cause, trace each cause under **Trace the consequence surface**, and apply one correction for the whole set.

  Fixing the first failure and rerunning from the start hides later symptoms and turns one round into many. This is the pattern the rule forbids.

- **Choose the principled course.** Decide from evidence, correctness, product boundaries, and the durable consequence. Time, difficulty, and consequence surface are reasons to investigate and validate more carefully, never reasons to settle for a shortcut, workaround, or weaker standard.
- **Default over ask.** On an ambiguous detail, pick the sensible default and say what you chose; reserve questions for forks only the user can settle.
- **Unattended runs keep moving.** In an issue campaign's authorized phases or under a standing autonomous mandate, take every reversible step the authorization covers without asking. Stop only when nothing can move without the user, or before a destructive action the workflow has not authorized.
- **Background work never stops the turn.** A background command never justifies stopping or ending the turn, whether or not the user is present. Keep working in the same turn while its result is pending. Follow the active workflow's order or, where it sets none, this order:

  1. Read and diagnose the log of every check or process that already failed.
  2. Run a complete self-review round over the current change, starting from a risk no earlier round examined.
  3. Run local tests over the affected scope.
  4. Continue the next implementation.
  5. Research the consequence surface.

  Between items, check the pending work and read each result as it lands.

  Ending the turn on a scheduled wake-up, background monitor or status report while a needed result is pending is the pattern this forbids.

  Rerunning a failed check without reading its log is not a diagnosis.

- **Keep the user oriented.** Give brief progress updates on multi-step work.
- **Match the user's language.** Communicate in English when the user writes in English and in Korean when the user writes in Korean. Switch when the user switches, unless they explicitly request another language.

## Skills

Each skill is `.agents/skills/<name>/SKILL.md`. Read it when its trigger applies.

- [`project`](.agents/skills/project/SKILL.md): the product contract, package ownership, and the graph and evidence contracts. Read when a task crosses packages or needs the owning package, and before changing `packages/graph`, graph benchmark prompts, or `@ttsc/evidence` semantics.
- [`contracts`](.agents/skills/contracts/SKILL.md): self-acknowledgments for production declarations and tests. Read when implementing or reviewing maintained source, unit tests or E2E tests, or selecting Evidence checklists.
- [`development`](.agents/skills/development/SKILL.md): implementation procedures, testing, validation, and change integrity. Read before changing source, tests, fixtures, workflows, or package wiring.
- [`typescript-go-sync`](.agents/skills/typescript-go-sync/SKILL.md): the `packages/ttsc/shim` bridge to typescript-go. Read before adding a shim re-export, bumping typescript-go, or chasing a missing compiler API.
- [`documentation`](.agents/skills/documentation/SKILL.md): READMEs, website guides, `AGENTS.md`, skills, and prose. Read before writing or changing any of them.
- [`review`](.agents/skills/review/SKILL.md): the review law, Overall Self-Review, and Individual Self-Review. Read for every review request.
- [`issue-campaign`](.agents/skills/issue-campaign/SKILL.md): repeated full-scope discovery, issue publication, and one pull request per cycle. Read for a broad audit or repeated issue-to-pull-request work, not for one defined issue.
- [`pull-request`](.agents/skills/pull-request/SKILL.md): branch, commit, pull request, checks, and merge. Read only when the user asks to open, update, or merge one, or a standing autonomous mandate covers delivery.
- [`benchmark`](.agents/skills/benchmark/SKILL.md): the performance, graph, and evidence benchmarks. Read before running, changing, or publishing a benchmark or its fixtures.

## Maintenance

Before changing this file or any skill, read [the documentation skill's skills.md](.agents/skills/documentation/skills.md).
