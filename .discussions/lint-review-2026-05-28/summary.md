# Summary — `@ttsc/lint` Full Audit, Round 1

Workflow: AGENTS.md §4.3 Research Review Rounds.
Topic directory: `.discussions/lint-review-2026-05-28/`.

## Outcome

Round 1 ran with six agents covering disjoint slices of `packages/lint/`:

| Agent | Scope | Knowledge base | Proposals filed |
| --- | --- | --- | --- |
| 1 | `linthost/` Go rule implementations | `agent-1-linthost-rules/knowledge.md` | 18 |
| 2 | `test/rules/**` Go test suite | `agent-2-linthost-tests/knowledge.md` | 7 |
| 3 | `src/**` TypeScript launcher | `agent-3-lint-src-ts/knowledge.md` | 8 |
| 4 | `rule/`, `lib/`, `plugin/`, `linthost/lsp.go` | `agent-4-lint-public-api/knowledge.md` | 8 |
| 5 | `README.md` + `website/src/content/docs/lint/**` | `agent-5-lint-docs/knowledge.md` | 4 |
| 6 | Per-family upstream rule coverage | `agent-6-missing-rules/knowledge.md` | 10 (mostly deferred per agent scope) |

Three transcripts (`round1.md`, `round2.md`, `round3.md`) + collated `proposals.md` + `lead-validation.md` document the workflow output.

**Applied in Round 1 (5 commits on `fix/lint-review-round-1`):**

1. `fix(lint): correct 15 unicorn rule logic bugs` — Agent 1.
2. `fix(lint): tighten public Go contract and LSP error reporting` — Agent 4.
3. `fix(lint): reduce config-discovery syscalls and tighten plugin loader` — Agent 3.
4. `docs(lint): re-count rule families and surface the 11 missing rule bullets` — Agent 5.
5. `test(lint): tighten rule helpers and split multi-assertion fix tests` — Agent 2.

**Round 1 numbers:** 49 proposals across 6 agents; 32 accepted, 5 accepted-with-scope-adjustment, 10 deferred, 2 rejected (incl. one reverted after a pinned test caught the regression).

## Open follow-up items (for individual scoped PRs)

Filed as a single deferred-work list per AGENTS.md feedback memory `feedback_deferred_work_as_issue.md`. Each item is self-contained for a fresh agent.

1. **`unicorn/consistent-assert` slug rename or body rewrite** — rule slug claims upstream's consistent-assert semantics; body implements a strict-equality preference. Rename to `unicorn/prefer-strict-assert` (touches: linthost rule, ITtscLintUnicornRules interface, README, unicorn.mdx, test, fixture) OR rewrite body to match upstream's `assert.ok(...)` vs `assert(...)` shape.
2. **Verify three unicorn upstream URLs** — Agent 1 says `no-array-reverse`, `no-array-sort`, `no-immediate-mutation` URLs 404 upstream; Agent 6's coverage table says unicorn is 146/146. Fetch upstream rule index, reconcile, then either correct the headers or rename the slugs.
3. **Decide on `unicorn/dom-node-dataset` alias** — same verification gap as #2 (Agent 6 says upstream renamed `prefer-dom-node-dataset`).
4. **De-boilerplate 161-file doc-comment cluster** — control-flow 35/43, typescript 25/81, runtime-safety 25/29, functions-classes 24/30, arrays-objects 13/14, variables-assignments 11/12, strings-regex 11/17, style-suggestions 10/18, imports-modules 4/8, comments-directives 3/4. Each file needs a case-specific *why* paragraph per AGENTS.md §2.2. Recommend per-family PRs.
5. **Option-arm coverage for option-heavy rules** — `unicorn/prevent-abbreviations`, `unicorn/expiring-todo-comments`, `unicorn/catch-error-name`, `unicorn/filename-case` (currently zero coverage), `eqeqeq` (smart/allow-null), `no-console` (allow), `complexity`/`max-params` (max override), `playwright/max-expects`, `react/only-export-components` per-option.
6. **TTSX loader stdout sentinel framing** — `packages/lint/src/index.ts:399-411`. Wrap loader stdout in `<<<TTSC_LINT_BEGIN>>>…<<<TTSC_LINT_END>>>`. Add a regression test that injects banner noise. Update the parser at line 613.
7. **`TokenRange` zero-width guard** — debatable; needs a real-world bug to motivate the contract change.
8. **README slim** — `packages/lint/README.md` currently 1197 lines, mostly a flat rule catalog. Per AGENTS.md §3.1, READMEs are direct/practical with deep detail on the website. Slim to one paragraph per family + link to MDX.
9. **Missing rules** — per Agent 6's coverage report, 453 conservative or 566 inclusive missing slugs across families. Recommended batching:
   - Cheap one-liners first: nextjs `no-location-assign-relative-destination`, boundaries `no-ignored`+`no-unknown-files`, react-hooks (9 Compiler-derived rules sharing infra with existing 8).
   - Modern-React subset (~12 rules).
   - Shared jest/vitest driver (~45 mirrored rules, ~90 slugs closed).
   - Playwright remaining 27.
   - eslint-plugin-import green field (46 rules, ttsc has the Program/Checker eslint-plugin-import has to fight for).
   - eslint-comments 9 rules.
   - jsdoc / regexp / typescript-eslint backlogs (each substantial).

## Conclusion

The audit met its stated goal: surface concrete, verifiable improvements in `@ttsc/lint`'s rule logic, test discipline, public API, and documentation. Round 1 landed 32 verified proposals across 5 commits. Remaining work is structural and per-family; pursuing it in a Round 2 with the same scope would mostly re-surface the deferred items already documented above, so the cycle terminates here and the deferred items become individually-tracked follow-ups.
