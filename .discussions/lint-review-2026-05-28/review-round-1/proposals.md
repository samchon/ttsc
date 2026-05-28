# Round 1 — Final Proposals

Each agent files its concrete proposals for lead validation. Format per proposal: `Pn` (proposal id), location, change, rationale.

## Agent 1 — linthost rule correctness

- **P1.1** `packages/lint/linthost/rules_unicorn_no_useless_collection_argument.go:37-40` — when `len(call.Arguments.Nodes) == 0`, return without Report instead of reporting. Today's code fires on every `new Set()` / `new Map()`.
- **P1.2** `packages/lint/linthost/rules_unicorn_no_unreadable_array_destructuring.go:58` — change threshold `>= 3` to `>= 2`; update file header comment.
- **P1.3** `packages/lint/linthost/rules_unicorn_no_negation_in_equality_check.go:37-38` — do NOT `stripParens` on `bin.Left` before testing for `!`; parens are the documented escape hatch.
- **P1.4** `packages/lint/linthost/rules_unicorn_prefer_includes.go:84-89` — restrict the swap-side helper to symmetric operators (`===`, `!==`, `==`, `!=`); keep asymmetric operators (`<`, `>=`, `>`) on the original orientation only.
- **P1.5** `packages/lint/linthost/rules_unicorn_consistent_existence_index_check.go:46-47` — same fix as P1.4.
- **P1.6** `packages/lint/linthost/rules_unicorn_consistent_assert.go` — body implements the wrong semantics (flags `equal → strictEqual`); rule slug `consistent-assert` upstream is about the `assert(...)` vs `assert.ok(...)` shape. Either rename the slug to `prefer-strict-assert` (and add to interface + docs) or rewrite the body. Recommend the rename — body is functionally useful.
- **P1.7** `packages/lint/linthost/rules_unicorn_no_useless_length_check.go:38-60` — remove `"every"` from the `&&` set; only `some`/`forEach`/`map`/`filter` are safe there. (`every` returns `true` on empty arrays, so the length check is load-bearing.)
- **P1.8** `packages/lint/linthost/rules_unicorn_no_useless_fallback_in_spread.go:25-67` — only fire when the SpreadElement's parent is `ArrayLiteralExpression` and only fire on SpreadAssignment whose parent is `ObjectLiteralExpression`. Spreading into call args is load-bearing.
- **P1.9** `packages/lint/linthost/rules_unicorn_no_for_loop.go:30-33` — require RHS of `<` to be a property access ending in `.length` to flag.
- **P1.10** `packages/lint/linthost/rules_unicorn_no_useless_undefined.go:37,48` — fix the duplicate identical message; the explicit-return arm should say "\`return undefined;\` and bare \`return;\` have the same effect."
- **P1.11** `packages/lint/linthost/rules_unicorn_prefer_optional_catch_binding.go:44` — replace `strings.Contains(nodeText(file, catch.Block), name)` with an identifier-walk over the catch body, or at minimum a `\\b` word-boundary regex.
- **P1.12** `packages/lint/linthost/rules_unicorn_no_array_reverse.go`, `rules_unicorn_no_array_sort.go`, `rules_unicorn_no_immediate_mutation.go` — header URLs point at nonexistent upstream docs. Either remove the URLs, or rename the rules and document them as ttsc-only.
- **P1.13** `packages/lint/linthost/rules_unicorn_prefer_array_flat_map.go:21-44` — require `.flat()` to be argument-less or `flat(1)`.
- **P1.14** `packages/lint/linthost/rules_unicorn_prefer_modern_math_apis.go:23-53` — match the commutative swap of `Math.LOG10E * Math.log(x)`.
- **P1.15** `packages/lint/linthost/rules_unicorn_no_static_only_class.go:23-46` — return early if the class declaration has heritage clauses.
- **P1.16** `packages/lint/linthost/rules_unicorn_no_useless_iterator_to_array.go:27-58` — only fire when the spread is consumed by an iterator-position (for-of, spread, destructuring, function call spread).
- **P1.17** `packages/lint/linthost/rules_unicorn_prefer_string_replace_all.go` — only fire when the regex source is a literal string without metacharacters.
- **P1.18** `packages/lint/linthost/rules_unicorn_no_accessor_recursion.go:36-51` — don't descend into nested non-arrow function bodies during the walk.

## Agent 2 — test suite quality

- **P2.1** De-boilerplate the 161-file doc-comment cluster across `control-flow`, `typescript`, `runtime-safety`, `functions-classes`, `arrays-objects`, `variables-assignments`, `strings-regex`, `style-suggestions`, `imports-modules`, `comments-directives`. Each file's middle paragraph must state the *why* / *which branch* per AGENTS.md §2.2.
- **P2.2** Tighten `assertReactRuleFinds`, `assertJsxA11yRuleFinds`, `assertSolidFindings` to assert `findings[0].Rule == ruleName`. Update the 12 vitest tests to assert the rule name. (~85 call sites + 3 helpers.)
- **P2.3** Tighten `assertFunctionalFinding` to require an exact count (or assert no extra findings beyond the matched one). (~27 call sites.)
- **P2.4** Split each of the four multi-assertion `*_fix_test.go` files into per-scenario files:
  - `packages/lint/test/rules/style-suggestions/no_extra_boolean_cast_fix_test.go` → 3 files
  - `packages/lint/test/rules/strings-regex/prefer_template_fix_test.go` → 3 files
  - `packages/lint/test/rules/control-flow/no_unneeded_ternary_fix_test.go` → 3 files
  - `packages/lint/test/rules/arrays-objects/dot_notation_fix_test.go` → 3 files
- **P2.5** Drop the four pure-duplicate functional pairs:
  - `functional/functional_no_classes_rejects_class_declaration_test.go` ↔ `functional_no_classes_rejects_class_test.go`
  - `functional/functional_no_let_rejects_let_declaration_test.go` ↔ `functional_no_let_rejects_let_test.go`
  - `functional/functional_no_try_statements_rejects_try_test.go` ↔ `functional_no_try_statements_rejects_catch_test.go` (exact same source)
  - `functional/functional_prefer_tacit_rejects_single_argument_wrapper_test.go` ↔ `functional_prefer_tacit_rejects_trivial_wrapper_test.go`
- **P2.6** Add a `packages/lint/test/rules/README.md` documenting the engine-direct contract (per AGENTS.md §2.2 helper, prevents future reviewers from misreading the engine-direct pattern as a violation).

## Agent 3 — src/ TypeScript

- **P3.1** `packages/lint/src/index.ts` — unify `unwrapDefault` (line 849, 8 hops) and `extractPluginSource` (line 451, 4 hops) into one helper used by JSON / CJS / ttsx-loader call sites.
- **P3.2** `packages/lint/src/index.ts:262-279` (`findLintConfigFile`) — replace per-directory `existsSync + statSync` storm with one `readdirSync` per level + set intersection against the candidate filename set.
- **P3.3** `packages/lint/src/index.ts:790-812` — wrap the bare `require(resolved)` call with the same friendly error wrapper used in `loadContributorPluginViaRequire`.
- **P3.4** `packages/lint/src/structures/rules/ITtscLintRuleOptionsMap.ts` — add `"boundaries/dependencies"` mapping. (Also flagged by Agent 5.)
- **P3.5** `packages/lint/src/index.ts:109` — drop `@internal` from the `createTtscPlugin` default-export JSDoc; it's the documented host hook.
- **P3.6** `packages/lint/src/defaultFormat.ts:10-13` — JSDoc example uses capitalized `Import` / `Export`; restore lowercase and wrap as a code fence.
- **P3.7** `packages/lint/src/index.ts:399-411` — sentinel-frame the ttsx loader stdout (e.g. `<<<TTSC_LINT_BEGIN>>>` / `<<<TTSC_LINT_END>>>`) and slice in the parent; insulates against ttsx-side stdout noise.
- **P3.8** `packages/lint/src/index.ts:382-388` — drop unused `argv` from the inline `declare const process`.

## Agent 4 — public Go API

- **P4.1** Add `packages/lint/test/plugin/severity_constants_link_test.go` asserting `int(rule.SeverityOff) == int(linthost.SeverityOff)` etc. for Warn and Error.
- **P4.2** `packages/lint/rule/astutil/astutil.go:30-41` — either drop the `strings.TrimRight` in `NodeText` or update the doc comment to mention the trailing-whitespace strip. Agent 4 to verify internal callers before deciding.
- **P4.3** `packages/lint/rule/astutil/astutil.go:132-143` — add `pos >= end` guard to `TokenRange` returning the safe shrunk range.
- **P4.4** `packages/lint/plugin/main.go:1-16` — update the doc comment to list all eleven verbs, or refactor the comment to defer to `dispatch.go` as the canonical source.
- **P4.5** `packages/lint/linthost/lsp.go:72,192,210` — remove the dead `--range-json` plumbing (or implement range-aware code actions; removal is cheaper).
- **P4.6** `packages/lint/linthost/lsp.go:644-657` — `firstURIArgument`: special-case empty/whitespace input with a "missing URI argument" error before attempting `json.Unmarshal`.
- **P4.7** `packages/lint/linthost/lsp.go:485-542` — `copyLSPCommandWorkspaceEntry`: drop `defer delete(seenDirs, realDir)` so the symlink-loop guard persists across siblings.
- **P4.8** `packages/lint/rule/rule.go:112-127` — rewrite the contradictory `FixReporter` doc comment.

## Agent 5 — documentation

- **P5.1** `website/src/content/docs/lint/rules/index.mdx:11-33` — rewrite the rule-families table with correct counts and a Unicorn row. Recompute counts from `packages/lint/src/structures/rules/ITtscLint*Rules.ts`.
- **P5.2** Add the 11 missing rule bullets to both README and MDX:
  - 2 core: `consistent-return`, `no-shadow` → `README.md` § ESLint core + `website/src/content/docs/lint/rules/core.mdx`.
  - 9 typescript: `no-unnecessary-qualifier`, `no-unsafe-argument`, `no-unsafe-assignment`, `no-unsafe-call`, `no-unsafe-member-access`, `prefer-find`, `prefer-regexp-exec`, `prefer-return-this-type`, `sort-type-constituents` → `README.md` § TypeScript + `website/src/content/docs/lint/rules/typescript.mdx`.
- **P5.3** Update the "580+ rules" claim in `packages/lint/README.md:14` and `website/src/content/docs/lint/index.mdx:26` to the real total (725 today). Add Unicorn to the inline category list in `index.mdx:26`.
- **P5.4** `website/src/content/docs/lint/setup.mdx` — add a one-line mention of the `configFile` escape hatch next to the auto-discovery paragraph.

## Agent 6 — missing rules (Round 1 scope only)

- **P6.1** `packages/lint/linthost/rules_unicorn_prefer_dom_node_dataset.go` — add a `dom-node-dataset` slug alias pointing at the existing rule, since upstream renamed `prefer-dom-node-dataset` → `dom-node-dataset`. Keep the old slug for backward compatibility for now.

(All other missing-rule work is explicitly deferred to follow-up scoped PRs per AGENTS.md feedback memory on deferred work.)
