# Round 3 — Consolidation and Prioritization

Lead (scribe): each agent locks in their top-priority proposals and signals what should be deferred to Round 2 (a fresh team).

## Agent 1 — final priorities

**Must land in Round 1 (correctness bugs):**

1. `rules_unicorn_no_useless_collection_argument.go:37-40` — invert the early-return.
2. `rules_unicorn_no_unreadable_array_destructuring.go:58` — `>= 3` → `>= 2` + update header.
3. `rules_unicorn_no_negation_in_equality_check.go:37-38` — drop the `stripParens(bin.Left)` before the `!` test.
4. `rules_unicorn_prefer_includes.go:84-89` + `rules_unicorn_consistent_existence_index_check.go:46-47` — asymmetric operators only on the original orientation.
5. `rules_unicorn_consistent_assert.go` — flag as wrong-rule-body; recommend either renaming the rule slug to `prefer-strict-assert` or rewriting the body for the real `consistent-assert` semantics. Lead's call.
6. `rules_unicorn_no_useless_length_check.go:38-60` — remove `every` from the `&&` set; split by parent operator.
7. `rules_unicorn_no_useless_fallback_in_spread.go:25-67` — gate on parent kind (array/object literal only).
8. `rules_unicorn_no_for_loop.go:30-33` — require RHS of `<` to be a `.length` access.
9. `rules_unicorn_no_useless_undefined.go:37,48` — fix the duplicate error message.
10. `rules_unicorn_prefer_optional_catch_binding.go:44` — replace substring check with identifier walk (or word-boundary regex as a minimum).

**Lower-confidence but high-value (still in Round 1 if validation confirms):**

- `prefer-array-flat-map` — depth check.
- `prefer-modern-math-apis` — commutative swap.
- `no-static-only-class` — skip classes with `extends`.
- `no-useless-iterator-to-array` — parent-position check.
- `prefer-string-replace-all` — literal-only regex gate.
- `no-accessor-recursion` — don't descend into nested non-arrow functions.

**Defer (option-surface work):**

- `catch-error-name` options (`name`, `ignore`), `expiring-todo-comments` options, `prevent-abbreviations` options. These are real gaps but they're additive work; Round 2 with a team focused on option-decoding patterns is the right home.

## Agent 2 — final priorities

**Must land:**

1. De-boilerplate the 161-file doc-comment cluster. Mechanical but high-touch: each file needs a case-specific *why* paragraph. Recommend a scripted pass that opens each file, removes the boilerplate paragraph, and leaves a TODO marker where a human-written sentence is needed — then triage the TODOs in batches.
2. Tighten `assertReactRuleFinds`, `assertJsxA11yRuleFinds`, `assertSolidFindings`, and the 12 vitest tests to assert `findings[0].Rule == ruleName`. Direct edit, ~85 sites.
3. Tighten `assertFunctionalFinding` to require an exact finding count.
4. Split the four multi-assertion `*_fix_test.go` files into per-scenario files: `no_extra_boolean_cast_fix`, `prefer_template_fix`, `no_unneeded_ternary_fix`, `dot_notation_fix`.
5. Drop the four pure-duplicate functional test pairs (or rewrite one of each pair to exercise a genuinely different branch).
6. Add a `packages/lint/test/rules/README.md` documenting the engine-direct contract.

**Defer (option-arm coverage):**

The option-arm coverage list (eqeqeq smart/allow-null, no-console allow, complexity/max-params max, playwright/max-expects max, react/only-export-components per-option, unicorn/filename-case) is real but each rule is its own small project. Round 2 with a team focused on option arms is the right home.

## Agent 3 — final priorities

**Must land:**

1. Unify `unwrapDefault` and `extractPluginSource` into one helper used by all 3 sites.
2. Replace `findLintConfigFile` per-directory stat-storm with `readdirSync + set intersection`.
3. Wrap the bare `require()` call in `normalizePluginValue` (line 805) with `loadContributorPluginViaRequire`-style error handling.
4. Add `boundaries/dependencies` to `ITtscLintRuleOptionsMap`.
5. Drop `@internal` from `createTtscPlugin` JSDoc.
6. Fix the `defaultFormat.ts` JSDoc example (`Import`/`Export` → lowercase, code fence).
7. Add sentinel framing to the ttsx loader stdout.

**Defer:**

- Per-process memo cache layer (perf-positive but trickier to validate).
- Curated barrel for `structures/index` (cosmetic; risk of breaking augmentation users).

## Agent 4 — final priorities

**Must land:**

1. Add a constant-link test pinning `rule.SeverityX == linthost.SeverityX` (the unchecked cast in `contrib_adapter.go:98`).
2. Document `NodeText`'s trailing-whitespace strip — or drop the strip if no internal caller depends on it (Agent 4 to verify before deciding).
3. Add the `pos >= end` guard to `TokenRange`.
4. Update `plugin/main.go` banner to list all eleven verbs (or point at `dispatch.go` as canonical).
5. Either implement range-aware code actions or remove the dead `--range-json` plumbing in `lsp.go`. Removal is cheaper for Round 1.
6. Special-case empty input in `firstURIArgument` for "missing URI argument" error.
7. Drop `defer delete(seenDirs, realDir)` in `copyLSPCommandWorkspaceEntry`.
8. Rewrite the contradictory `FixReporter` doc comment.

**Defer:**

- Workspace-copy lazy mode (skip `dist`/`build`/`.next`/`out`/`coverage`) — improvement but tied to a behavior change worth validating against the VS Code client.
- LSP `textDocument/didChange` integration — substantial design work; Round 2 or its own focused PR.
- `go.mod` toolchain decision — needs the user's go-version policy call.

## Agent 5 — final priorities

**Must land:**

1. Rewrite `rules/index.mdx:11-33` rule-families table with correct counts and a Unicorn row.
2. Add the 11 missing rule bullets (2 core, 9 typescript) to both `README.md` and `rules/core.mdx` / `rules/typescript.mdx`.
3. Update the "580+ rules" claim in `README.md:14` and `index.mdx:26` to the actual total; include Unicorn in the inline category list.
4. Add a one-line mention of `configFile` in `setup.mdx`.

**Defer:**

- README trim from 1197 lines down to a per-family-link skeleton. Aligned with AGENTS.md §3.1 but requires deciding what each family's one-paragraph blurb says — Round 2 with an editorial team.
- CI drift-check (interface keys vs README/MDX bullets) — useful but its own scoped PR.

## Agent 6 — final priorities

**Must land (cheap one-line gaps):**

1. Add an alias `unicorn/dom-node-dataset` pointing at the existing `unicornPreferDomNodeDataset` rule.

**Defer to scoped Round 2+ PRs (large structural work — per AGENTS.md feedback memory `feedback_deferred_work_as_issue.md`, each should be filed as a self-contained GitHub issue):**

- Nextjs `no-location-assign-relative-destination` (1 rule).
- Boundaries `no-ignored` + `no-unknown-files` (2 rules).
- React-Hooks 9 React-Compiler-derived rules.
- React "modern subset" ~12 rules.
- Shared `rules_test_framework.go` driver closing ~90 jest+vitest slugs.
- Playwright 27 missing rules (about 10 reusable via the test-framework driver).
- eslint-plugin-import green field — `rules_import_*.go` family.
- eslint-comments 9 rules.
- jsdoc ~14 must-have rules.
- regexp ~11 high-value rules.
- typescript-eslint 37 missing rules.
- eslint core ~30 genuinely missing semantic rules.

## Cross-team consensus locked in

- Doc-comment quality (Agent 2) + README/MDX accuracy (Agent 5) move together; the boilerplate-fix pass should produce a script the docs CI can reuse to assert per-family bullet counts.
- `boundaries/dependencies` map gap is high-confidence (Agents 3 and 5 hit it independently).
- Severity-constant link assertion (Agent 4) and TS-side severity union (Agent 3) both deserve a shared assertion — both proposals are accepted.
- Three rules (`no-array-reverse`, `no-array-sort`, `no-immediate-mutation`) with phantom upstream URLs (Agent 1) tie back to docs (Agent 5) and rule-naming honesty. Lead's call whether to remove them or rename.

## Cross-team disagreements

- None substantive. The only friction is timing — Agents 5 and 6 both want broader rewrites that go beyond Round 1 scope. Round 1 stays scoped to bug fixes, doc-accuracy fixes, the 11 missing bullets, the one unicorn alias, and the cheap structural cleanups in src/, rule/, lsp.go, plugin/.

End of Round 1 discussion. Each agent now files their final proposals in `proposals.md`.
