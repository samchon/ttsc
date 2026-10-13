# AGENTS.md

`ttsc` is a general-purpose TypeScript compiler wrapper and toolchain on unmodified TypeScript-Go: the `ttsc`, `ttsx`, and `ttscserver` CLIs, their runtime, plugin, and LSP hosts, and the Go-source plugin protocol. typia and nestia are compatibility fixtures, not the product definition.

## Attitude

- Do the literal request. Widen or reinterpret it only when the user hands that over, and do not edit code the change does not need.
- The user's instruction outranks a skill. When the user asks a question, answer it directly before continuing any work.
- Reply in the user's language. Write code, comments, commits, issues, and pull requests in English.
- Treat a reported defect or review claim as a hypothesis until code, tests, and history confirm it.
- Fix the cause and every case it produces. No shortcut, workaround, or special case, however hard the real fix.
- Let a test run, CI run, or review round finish, then fix all of its findings together by cause. Fixing the first failure and rerunning is the pattern to avoid.
- Decide ambiguous details yourself and say what you chose; ask only when readings lead to materially different work.
- Do the work yourself; use subagents only when the user asks for them.
- Delete every scratch file you create once it has served.
- Never alter TypeScript-Go itself, whether source, binary, cache, or a patched vendor. Use only APIs of an unmodified upstream version, and record a needed upstream fix with its owner instead of emulating it.

## Finishing Work

A message without a tool call ends the turn. While work remains, do not end it with a summary that announces the next step, an offer to continue, a list of non-blocking decisions, a report because a stage finished, or a wait on background work. Put status notes in the same message as the next tool call. While a background result is pending, diagnose failed logs, review, test, or keep implementing.

Stop only when nothing can move without the user, a protected target blocks you, or a destructive or outward-facing action needs confirmation. Inside an authorized campaign or an autonomous mandate, take every reversible step it covers without asking.

## Skills

Read a skill when its trigger applies, and the documentation skill before changing this file or any skill.

- [contracts](.agents/skills/contracts/SKILL.md): the `@evidence` checklists every maintained declaration and test answers. Read when writing or reviewing maintained source or tests.
- [development](.agents/skills/development/SKILL.md): repair, tests, validation, and CI. Read before changing code, tests, fixtures, or workflows.
- [typescript-go-sync](.agents/skills/typescript-go-sync/SKILL.md): the `packages/ttsc/shim` bridge. Read before touching the shim or bumping typescript-go.
- [documentation](.agents/skills/documentation/SKILL.md): read before writing `AGENTS.md`, a skill, a README, or a website guide.
- [review](.agents/skills/review/SKILL.md): read for any review or self-review.
- [issue-campaign](.agents/skills/issue-campaign/SKILL.md): read for a broad audit or repeated issue-to-pull-request work.
- [pull-request](.agents/skills/pull-request/SKILL.md): read only when asked to push, open, update, or merge, or under a delivery mandate.
- [benchmark](.agents/skills/benchmark/SKILL.md): read before running, changing, or publishing a benchmark.
