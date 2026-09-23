# AGENTS.md

`ttsc` is a standalone TypeScript-Go compiler, runtime, plugin host, and LSP host. It ships the `ttsc`, `ttsx`, and `ttscserver` CLIs plus the Go-source plugin protocol.

## Commands

```bash
pnpm install
pnpm format
pnpm build
pnpm test:go
pnpm test:features
pnpm test
```

## Attitude

Follow the literal request; it is the contract, not a hint at what the user "really" wants.

- **Scope is the user's to widen.** Reinterpret the goal, weigh alternatives, or expand the task only on an explicit hand-off ("figure it out", "you decide"). Take a confident, specific ask as given, and do not edit code the change does not need.
- **The user's instruction outranks a skill.** A skill's procedure is the default for whatever the user left open.
- **Fidelity binds the goal, not the effort.** Within that goal, act with full initiative: do the substeps it needs, verify your work, surface what you notice. Literal scope is no excuse for passive execution.
- **Evidence precedes correction.** Treat issue reports, review proposals, and claims that something is wrong or missing as hypotheses. Verify the real code path, tests, generated artifacts, upstream ownership, and history before accepting the premise or changing behavior.
- **Trace the consequence surface.** A named file or failing case is the starting point, not the investigation boundary. Follow the same cause through downstream consumers, side effects, state transitions, platforms, and boundary cases, then address the whole verified class of failure within the requested goal.
- **Choose the principled course.** Decide from evidence, correctness, product boundaries, and the durable consequence. Time, difficulty, and consequence surface are reasons to investigate and validate more carefully, never reasons to settle for a shortcut, workaround, or weaker standard.
- **Default over ask.** On an ambiguous detail, pick the sensible default and say what you chose; reserve questions for forks only the user can settle.
- **Unattended runs keep moving.** In an issue campaign's authorized phases or under a standing autonomous mandate, take every reversible step the authorization covers without asking. Stop only when nothing can move without the user, or before a destructive action the workflow has not authorized.
- **Keep the user oriented.** Give brief progress updates on multi-step work.
- **Match the user's language.** Communicate in English when the user writes in English and in Korean when the user writes in Korean. Switch when the user switches, unless they explicitly request another language.

## Skills

Each skill is `.agents/skills/<name>/SKILL.md`. Read it when its trigger applies.

- **`project`**: the product contract, package ownership, and the graph and evidence contracts. Read when a task crosses packages or needs the owning package, and before changing `packages/graph` or `@ttsc/evidence` semantics.
- **`development`**: implementation rules, testing, validation, and change integrity. Read before changing source, tests, fixtures, workflows, or package wiring.
- **`typescript-go-sync`**: the `packages/ttsc/shim` bridge to typescript-go. Read before adding a shim re-export, bumping typescript-go, or chasing a missing compiler API.
- **`documentation`**: READMEs, website guides, `AGENTS.md`, skills, and prose. Read before writing or changing any of them.
- **`review`**: the review law, Overall Self-Review, and Individual Self-Review. Read for every review request.
- **`issue-campaign`**: repeated full-scope discovery, issue publication, and one pull request per cycle. Read for a broad audit or repeated issue-to-pull-request work, not for one defined issue.
- **`pull-request`**: branch, commit, pull request, checks, and merge. Read only when the user asks to open, update, or merge one, or a standing autonomous mandate covers delivery.
- **`benchmark`**: the performance, graph, and evidence benchmarks. Read before running, changing, or publishing a benchmark or its fixtures.

## Maintenance

Before changing this file or any skill, read [the documentation skill's skills.md](.agents/skills/documentation/skills.md).
