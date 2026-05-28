# Review Round 1

Six agents, each with a slice of the lint package:

| Agent | Slug | Scope |
| --- | --- | --- |
| 1 | `agent-1-linthost-rules` | `packages/lint/linthost/*.go` — rule implementations. Logic correctness, AST handling, perf hotspots, dead code, missing options vs upstream behavior. |
| 2 | `agent-2-linthost-tests` | `packages/lint/test/rules/**/*_test.go` — test files. Bogus assertions, redundancy, missing branches, fragile fixtures. |
| 3 | `agent-3-lint-src-ts` | `packages/lint/src/**` — TypeScript launcher: command, config, engine, fix, format, plugin, printer, registry, rules, shared. |
| 4 | `agent-4-lint-public-api` | `packages/lint/rule/` (rule.go + astutil), `lib/`, `plugin/`, `go.mod`. Public Go API correctness, plugin host wiring, type/import surface. |
| 5 | `agent-5-lint-docs` | `packages/lint/README.md` + `website/src/content/docs/lint/**`. Doc accuracy vs current code, stale claims, dead links, missing rule pages. |
| 6 | `agent-6-missing-rules` | Per rule family (28+ families), upstream ESLint plugins. Surface rules NOT yet implemented; emphasis on unicorn family currently being expanded. |

Each agent writes to its own subdir; nothing else touches another agent's folder.

Discussion artifacts:
- `round1.md`, `round2.md`, `round3.md` — speaker-ordered transcripts
- `proposals.md` — one section per agent
- `lead-validation.md` — accept/reject per proposal with reason and applied diff reference
