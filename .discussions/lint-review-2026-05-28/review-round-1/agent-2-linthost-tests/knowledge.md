# Agent 2 — linthost test suite: knowledge base

## Files sampled

Total tests examined: 716 `*_test.go` files across 28 families.

Per-family counts (full census):
- arrays-objects 14, boundaries 7, comments-directives 4, control-flow 43,
- cypress 16, functional 33, functions-classes 30, imports-modules 8,
- jest 19, jsdoc 16, jsx-a11y 41, nextjs 22, playwright 34, promise 18,
- react 33, react-perf 7, runtime-safety 29, security 16, solid 10,
- storybook 16, strings-regex 17, style-suggestions 18, tanstack-query 8,
- testing-library 18, typescript 81, unicorn 133, variables-assignments 12, vitest 13.

Representative files read:
- Shared helper: `packages/lint/test/shared/helpers_test.go`
- Test-runner: `scripts/test-go-lint.cjs`
- unicorn: `unicorn_no_typeof_undefined_test.go`, `unicorn_no_null_test.go`,
  `unicorn_no_useless_length_check_test.go`, `unicorn_no_zero_fractions_test.go`,
  `unicorn_no_useless_spread_test.go`, `unicorn_consistent_existence_index_check_test.go`,
  `unicorn_prevent_abbreviations_test.go`, `unicorn_expiring_todo_comments_test.go`,
  `unicorn_empty_brace_spaces_test.go`, `unicorn_catch_error_name_test.go`,
  `unicorn_no_array_for_each_test.go`.
- control-flow: `no_unreachable_test.go`, `complexity_test.go`, `curly_test.go`,
  `no_negated_condition_test.go`, `no_unneeded_ternary_fix_test.go`.
- runtime-safety: `eqeqeq_test.go`, `no_console_test.go`.
- functions-classes: `adjacent_overload_signatures_test.go`, `max_params_test.go`,
  `getter_return_test.go`.
- functional: `functional_helpers_test.go` and 12 representative `functional_*_test.go`.
- typescript: `class_literal_property_style_test.go`,
  `strict_boolean_expressions_test.go`, `no_misused_promises_test.go`,
  `prefer_readonly_test.go`, `no_unsafe_unary_minus_test.go`.
- react: `react_helpers_test.go`, `react_no_array_index_key_reports_index_key_test.go`,
  `react_jsx_no_useless_fragment_test.go`,
  `react_jsx_key_reports_array_element_test.go`,
  `react_jsx_key_reports_conditional_map_element_test.go`,
  `react_jsx_key_reports_logical_map_element_test.go`,
  `react_only_export_components_honors_allow_options_test.go`.
- jsx-a11y: `jsx_a11y_helpers_test.go`, `jsx_a11y_alt_text_requires_img_alt_test.go`.
- cypress: 4 `cypress_assertion_before_screenshot_*_test.go`.
- vitest: `vitest_expect_expect_reports_empty_test_test.go` (+ pattern scan over all 12 vitest cases).
- promise: `promise_no_promise_in_callback_test.go`,
  `promise_always_return_test.go`,
  `promise_always_return_reports_conditional_fallthrough_test.go`.
- nextjs: 2 `no_async_client_component_*_test.go`.
- playwright: `playwright_max_expects_test.go`, `playwright_expect_expect_test.go`,
  3 `playwright_no_networkidle_*_test.go`.
- arrays-objects: `no_array_constructor_test.go`, `no_array_delete_test.go`,
  `no_dynamic_delete_test.go`, `dot_notation_test.go`, `dot_notation_fix_test.go`.
- imports-modules: `no_useless_empty_export_test.go`,
  `no_useless_empty_export_allows_module_marker_test.go`.
- style-suggestions: `no_empty_test.go`, `no_extra_boolean_cast_test.go`,
  `no_extra_boolean_cast_fix_test.go`.
- strings-regex: `prefer_template_fix_test.go`.
- variables-assignments: `no_var_test.go`, `no_var_skips_declaration_file_vars_test.go`.
- boundaries: `boundaries_helpers_test.go`, `boundaries_dependencies_test.go`,
  `boundaries_element_types_rejects_disallowed_import_test.go`.
- comments-directives: `ban_ts_comment_test.go`, `ban_tslint_comment_test.go`.
- jest: `jest_no_disabled_tests_test.go`.
- security: `security_detect_eval_with_expression_test.go`.
- storybook: `csf_component_test.go`, `await_interactions_test.go`,
  `hierarchy_separator_test.go`, `prefer_pascal_case_test.go`,
  `no_uninstalled_addons_test.go`.
- tanstack-query: `tanstack_query_exhaustive_deps_test.go`,
  `tanstack_query_no_void_query_fn_test.go`.
- jsdoc: `jsdoc_helpers_test.go`, `check_tag_names_test.go`.

## Patterns learned (what a clean test looks like here)

1. **Engine-direct unit layer.** Tests parse source via `parseTSFile`/`parseTSXFile`
   and call `NewEngine(rules).Run([]*shimast.SourceFile{file}, nil)` directly —
   they do *not* spawn the `ttsc lint` binary. This is intentional: the helper
   doc comment in `helpers_test.go:86-96` says these are Go unit tests for
   "coverage and debugging", while the end-to-end binary path is covered by
   `tests/test-lint/src/features/`. The shape is **not** a violation of
   AGENTS.md §2.2 (which targets ttsc's own test layout). Tests that need a
   real `Program` for type-aware rules switch to `seedLintProject` +
   `captureCommandOutput(run([]string{"check", ...}))` (e.g. `strict_boolean_expressions_test.go`,
   `no_misused_promises_test.go`, `no_unsafe_unary_minus_test.go`) — that path
   does invoke the real `lint check` entrypoint.

2. **Annotation-based corpus.** `assertRuleCorpusCase` (helpers_test.go:97) reads
   `// expect: rule severity` comments and asserts exact rule+severity+line triples
   via `normalizeRuleFindings`. This is the tightest pattern and is correctly
   used by ~600 tests.

3. **Family-local helpers** for JSX/options paths. `assertReactRuleFinds`,
   `assertJsxA11yRuleFinds`, `assertSolidFindings`, `assertJSDocRuleLines`,
   `runFunctionalRule`/`assertFunctionalFinding`, `runBoundaryRule`/
   `assertSingleBoundaryFinding`, `runTestingLibraryRules` — each family ships
   one `*_helpers_test.go` with the same shape but separate names.

4. **Clean per-test doc comments** in unicorn, react, jsx-a11y, cypress,
   playwright, promise, functional, vitest, storybook, tanstack-query, jest,
   security, nextjs, jsdoc, boundaries — all written individually with three-
   part shape (`Verifies …` headline, why-paragraph, 2-4 numbered steps).

## Findings — bogus or insufficient assertions

- **`functional/functional_helpers_test.go:28-29`** —
  `if len(findings) == 0 { t.Fatalf("…expected at least one finding") }`. This
  is the lower-bound bogus pattern: the rule could regress and emit 50 findings
  (e.g. tagging every `let` ever, including ones inside ignored patterns) and
  the test still passes. The companion code at line 40-42 short-circuits as
  soon as **one** finding's message contains `messagePart`, so multi-finding
  regressions are silently accepted. ~27 functional rule tests use this helper.

- **vitest family (12 files)** — Every `vitest_*_test.go` ends with
  `if len(findings) != 1 { t.Fatalf("expected one finding, got %v", findingRules(findings)) }`.
  The count is exact, but the rule name is never asserted. Compare to cypress
  which does `len(got) != 1 || got[0] != "cypress/no-and"`. A typo in the
  rule's registered id (or a refactor that renamed it) would not be caught.

- **`react/react_helpers_test.go:14-19`** + **`jsx-a11y/jsx_a11y_helpers_test.go:14-19`** —
  `assertReactRuleFinds`/`assertJsxA11yRuleFinds` require `len(findings) != 1`
  exactly, which is fine, then `strings.Contains(findings[0].Message, messagePart)`.
  The rule name is **not** asserted on findings[0]. Same hole as vitest:
  rule-id regressions slip through. ~70 react + jsx-a11y tests rely on this.

- **`variables-assignments/no_var_skips_declaration_file_vars_test.go:22`** —
  `file.IsDeclarationFile = true` is set on a `.ts` virtual file *after* parse.
  This mutates the AST node out of band; real `.d.ts` parsing sets additional
  scanner flags (`StatementsHasModifier`, etc.). The branch under test (rule
  skipping declaration files) is exercised, but a regression that gates on a
  property set during parse (not just `IsDeclarationFile`) would not surface.

- **`unicorn/unicorn_no_typeof_undefined_test.go:19`** — fixture uses
  `typeof globalThis === "undefined"`. `globalThis` is a known identifier and
  TypeScript's lib types declare it; if a future rule (e.g. `unicorn/prefer-global-this`,
  which the corpus does cover) is also enabled by default in some test path,
  this would emit two findings and break. Currently the harness only enables
  rules declared by `// expect:` annotations so this is robust, but the
  combination is worth noting as fragile to harness changes.

## Findings — redundant cases

- **`functional/functional_no_classes_rejects_class_declaration_test.go`** vs
  **`functional/functional_no_classes_rejects_class_test.go`** — both fire the
  rule against a class declaration; only differences are
  `class Store { value = 1; }` vs `class Box {}` and the message substring
  searched (`"Unexpected class"` vs `"class"`). Same dispatcher branch.

- **`functional/functional_no_let_rejects_let_declaration_test.go`** vs
  **`functional/functional_no_let_rejects_let_test.go`** — sources differ only
  by an unrelated `value = 2;` reassignment after the `let`. Same diagnostic.

- **`functional/functional_no_try_statements_rejects_try_test.go`** vs
  **`functional/functional_no_try_statements_rejects_catch_test.go`** — both
  use the **exact same source** `try { run(); } catch (error) { recover(error); }`.
  The only difference is the message substring searched (`"try"` vs
  `"try-catch"`). Names imply they cover the catch-clause branch separately,
  but the rule fires on the `try` keyword either way. Pure duplicate.

- **`functional/functional_prefer_tacit_rejects_single_argument_wrapper_test.go`** vs
  **`functional/functional_prefer_tacit_rejects_trivial_wrapper_test.go`** —
  both use `(value) => fn(value)` shape (just `Number` vs `transform` as the
  callee). Message substrings differ (`"wrapper"` vs `"Potentially"`) but the
  same diagnostic is emitted.

- **`functional/functional_no_return_void_rejects_void_annotation_test.go`** vs
  **`functional/functional_no_return_void_rejects_void_return_test.go`** —
  both use a `function …(): void {…}` declaration. The second adds `return;`
  inside but the rule reports the annotation, not the return statement.

- **`arrays-objects/no_array_delete_test.go`** and
  **`arrays-objects/no_dynamic_delete_test.go`** — different *rules* but
  identical fixture/test boilerplate; not redundant per se. (Listed here only
  because the two files are mechanically near-identical wrappers.)

## Findings — missing branches per rule

- **`unicorn/prevent-abbreviations`** — the rule has options (`replacements`
  dictionary, `whitelist`, `extendDefaultReplacements`, `ignore`, `checkFilenames`,
  `checkProperties`). The single corpus test pins one keyword (`idx`) under
  default options only. None of the option arms have coverage.

- **`unicorn/expiring-todo-comments`** — the rule has options (date pivot,
  custom terms, ignore patterns, ignored-date format). Only the default
  positive `// TODO:` arm is tested.

- **`unicorn/catch-error-name`** — `name` (canonical replacement) and `ignore`
  (allowed alternates) options are untested.

- **`unicorn/filename-case`** — no test file at all (option-heavy rule:
  `case`, `cases`, `ignore`, `multipleFileExtensions`).

- **`eqeqeq`** — `always`/`smart`/`allow-null` options untested; only the
  default `always` branch is exercised by `eqeqeq_test.go`.

- **`no-console`** — `allow` option (e.g. `["warn","error"]`) untested.
  Default-on configuration only.

- **`playwright/max-expects`** — `max` threshold override untested; the
  fixture hits 6 expects under the default 5.

- **`react/only-export-components`** — only the `allowConstantExport` +
  `allowExportNames` *both true* arm is tested
  (`react_only_export_components_honors_allow_options_test.go`). No test
  exercises each option independently or the rejection path with options off.

- **`functional/*`** generally — every rule has 1-3 positive tests with
  default options. The functional ESLint plugin's options
  (`ignoreClasses`, `ignoreInterface`, `ignoreCodePattern`, `ignoreNames`,
  etc.) are largely uncovered. (Some `*_ignores_*_pattern_test.go` files
  exist for `no-let` and `immutable-data`, but most rules have none.)

- **`unicorn/no-keyword-prefix`** (if registered) — option `disallowedPrefixes`
  needs verification; not in sampled set.

- **`complexity`** — `max` threshold override untested.

- **`max-params`** — `max` threshold override untested.

## Findings — AGENTS.md §2.2 violations

### Doc-comment shape (boilerplate vs case-specific)

A grep for the boilerplate string
`Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage`
matches **161 files** across 10 families. Every one of these has the same
generic three-paragraph header that says nothing about the specific case:

```
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in <fixture>.ts and compares normalized rule,
// severity, and line triples. The source text stays embedded in the generated Go file so the
// test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
```

This violates AGENTS.md §2.2 ("a short paragraph stating the non-obvious *why*",
"which branch or regression is being pinned"). It is the headline `Verifies …`
followed by **generic harness boilerplate**, not a case-specific rationale.

Distribution of boilerplate violators by family:
- control-flow: 35 of 43 files
- typescript: 25 of 81
- runtime-safety: 25 of 29
- functions-classes: 24 of 30
- arrays-objects: 13 of 14
- variables-assignments: 11 of 12
- strings-regex: 11 of 17
- style-suggestions: 10 of 18
- imports-modules: 4 of 8
- comments-directives: 3 of 4

Concrete examples:
- `control-flow/complexity_test.go:5-17` — generic header on a rule with a
  numeric threshold; should explain that score 25 vs limit 20 is being pinned.
- `control-flow/curly_test.go:5-17` — same generic header on a 6-branch
  fixture (if/else/while/do/for/for-of); the *why* paragraph should call out
  that each loop kind is its own dispatcher branch.
- `functions-classes/adjacent_overload_signatures_test.go:5-17` — generic.
- `runtime-safety/eqeqeq_test.go:5-17` — generic; no mention that only the
  default `always` arm is covered.
- `comments-directives/ban_ts_comment_test.go:5-17` — generic.
- `arrays-objects/no_array_constructor_test.go:5-17` — generic.

The newer per-family work (unicorn, react, jsx-a11y, cypress, playwright,
promise, vitest, jest, security, nextjs, storybook, tanstack-query, jsdoc,
boundaries, functional, solid, react-perf, testing-library, comments-directives'
`triple_slash_*` / `tsdoc_*`) has individually authored doc comments and is in
compliance. The boilerplate cluster is concentrated in the 10 older families
listed above.

### "One test case per file"

No file in `packages/lint/test/rules/**/*_test.go` declares more than one
`func Test*` (verified with `grep -c "^func Test"`). The eight files with zero
`Test*` are family helper files (`*_helpers_test.go`) — those are fine because
they only declare helper funcs, not tests.

However, **four files put multiple distinct scenarios inside one `Test*`**,
violating "one test case per file, named after what it asserts":

- **`style-suggestions/no_extra_boolean_cast_fix_test.go:22-40`** —
  `TestFixNoExtraBooleanCastDropsRedundantCoercionAndKeepsMeaningfulOnes`
  runs `assertFixSnapshot` for `!!x → x`, `assertFixSnapshot` for
  `Boolean(x) → x`, and `assertRuleSkipsSource` for `const b = !!x;`. Three
  cases in one func.

- **`strings-regex/prefer_template_fix_test.go:23-42`** —
  `TestFixPreferTemplateRewritesConcatChainIntoTemplateLiteral` runs three
  `assertFixSnapshot` calls covering 3-part concat, backtick escape, and
  leading-identifier chain. Three distinct branches in one func.

- **`control-flow/no_unneeded_ternary_fix_test.go:22-41`** —
  `TestFixNoUnneededTernaryRewritesBooleanLiteralBranches` runs three
  `assertFixSnapshot` calls (`?true:false`, parenthesized `?false:true`,
  simple `?false:true`). Three branches in one func.

- **`arrays-objects/dot_notation_fix_test.go:22-39`** —
  `TestFixDotNotationRewritesBracketAccessAndSkipsReservedKeys` runs
  `assertFixSnapshot` + `assertNoFixSnapshot` + `assertRuleSkipsSource`.
  Three distinct outcomes in one func.

Per AGENTS.md, each of these should be 3 separate `*_test.go` files named
after their assertion.

### Real-binary path

The Go unit tests intentionally call `NewEngine(...).Run(...)` directly
(see `helpers_test.go` headnote). This is *not* an AGENTS.md §2.2 violation
because the binary entrypoint is covered by the TypeScript `tests/test-lint`
suite. Type-aware tests that *do* need a Program correctly switch to
`captureCommandOutput(run([]string{"check", ...}))` — that is the real
in-process command entrypoint. **No tests mock the engine or shortcut around
the real production code paths.**

## Findings — fragile fixtures or slow setup

- **`storybook/no_uninstalled_addons_test.go`** — materializes a real temp
  directory with `package.json` + `.storybook/main.ts` and parses the file
  from disk. The rule needs filesystem resolution, so this is justified, but
  it is the slowest test in the storybook family (~10x other storybook tests
  by setup cost). Currently the only test exercising that branch, so no
  duplication, but a sibling negative case ("addon listed in dependencies,
  not devDependencies") would benefit from sharing the fixture rather than
  re-materializing it.

- **`boundaries/boundaries_*_test.go` (6 files)** — `runBoundaryRule` calls
  `t.TempDir()` per test and writes a small project tree. Cheap individually
  (3-4 files each), but six tests in lockstep across the family means ~25 disk
  writes for setup. Negligible compared to the engine work, but suggests
  consolidating onto a shared fixture builder if the family grows.

- **`typescript/no_misused_promises_test.go`,
  `typescript/strict_boolean_expressions_test.go`,
  `typescript/no_unsafe_unary_minus_test.go`** — each calls
  `seedLintProject(t, ...)` which spawns a full `tsgo` Program via the
  `check` command. These are by far the heaviest tests in the suite (real
  type-aware Program). Currently 3-4 such tests; pattern is fine but a
  shared setup helper would reduce future-test cost.

- **`variables-assignments/no_var_skips_declaration_file_vars_test.go:22`** —
  post-parse mutation `file.IsDeclarationFile = true` on a `.ts` file. Fragile
  to parser changes that set other flags during parse; ideally the fixture
  should use a `.d.ts` virtual filename so the scanner naturally classifies
  it.

- **Boundaries fixture path conventions** — `runBoundaryRule` accepts
  `sourcePath` as a slash-separated relative path and runs it through
  `filepath.FromSlash`, so the path is OS-portable. Pattern is correct.

- **No tests reach into `time.Now()`, `os.Getenv()`, `runtime.GOOS`, or
  randomness.** The `unicorn/expiring-todo-comments` rule has a date-based
  option that *should* depend on `time.Now`, but the current test doesn't
  exercise that branch at all (see missing-branches finding above).

## Candidate proposals (to surface in discussion)

1. **De-boilerplate the 161 generic doc-comment cluster.** Either delete the
   harness-boilerplate paragraph and require a case-specific *why*, or
   rewrite each header to call out the branch being pinned. The unicorn,
   react, cypress, etc. families show the bar; the legacy 10-family cluster
   sits below it.

2. **Split the four multi-assertion `*_fix_test.go` files into per-scenario
   files** (`no_extra_boolean_cast`, `prefer_template`, `no_unneeded_ternary`,
   `dot_notation` fix tests). Each scenario becomes its own `*_test.go` named
   after what it asserts.

3. **Tighten `assertFunctionalFinding`** — require an exact finding count
   (caller passes `len`) or, at minimum, assert that no extra findings exist
   beyond the matched one. The current "first match wins, all later findings
   ignored" pattern silently accepts regressions.

4. **Tighten the 12 vitest tests and ~70 react/jsx-a11y `assertReactRuleFinds`
   /`assertJsxA11yRuleFinds` callers** to assert `findings[0].Rule ==
   ruleName`. The cypress family already does this and it costs one extra
   `||` clause per test.

5. **Drop the four pure-duplicate functional pairs** identified above:
   - `functional_no_classes_rejects_class*` (keep one, expand it).
   - `functional_no_let_rejects_let*` (keep one).
   - `functional_no_try_statements_rejects_{try,catch}_test.go` — exact
     same source; pick one and write a real catch-branch test using a
     different shape (e.g. `try { … } finally {}` or `try { throw e }`).
   - `functional_prefer_tacit_rejects_{single_argument,trivial}_wrapper`
     — collapse, or rewrite one to exercise a *different* wrapper shape
     (e.g. multi-arg wrapper, async wrapper).
   - `functional_no_return_void_rejects_void_{annotation,return}` — keep
     the annotation test; rewrite the second to exercise the *return* arm
     with a return statement that returns `undefined` from a non-`void`-
     annotated function (if that is the intended second branch).

6. **Add option-arm coverage for high-value option-heavy rules**, starting
   with: `unicorn/prevent-abbreviations` (`replacements`, `ignore`),
   `unicorn/expiring-todo-comments` (date pivot, custom terms),
   `unicorn/catch-error-name` (`name`, `ignore`), `eqeqeq` (`smart`,
   `allow-null`), `no-console` (`allow`), `complexity`/`max-params`
   (`max` override), `playwright/max-expects` (`max`),
   `react/only-export-components` (each option independently).

7. **Add a missing `unicorn/filename-case` test.** Option-heavy and currently
   has zero coverage.

8. **Rewrite `no_var_skips_declaration_file_vars_test.go` to use a `.d.ts`
   virtual filename** so the parser sets `IsDeclarationFile` naturally,
   instead of post-parse mutation.

9. **Document the engine-direct testing contract in
   `packages/lint/test/rules/README.md`.** That README currently only lists
   families. A short note explaining that these tests intentionally bypass
   the CLI for engine coverage, and that type-aware rules use the
   `seedLintProject` real-binary path, would prevent future reviewers
   from misreading the pattern as a §2.2 violation.

10. **Consolidate `assertReactRuleFinds`, `assertJsxA11yRuleFinds`, and
    `assertSolidFindings` (which are 99% identical)** behind a shared
    `assertTSXRuleFinds(t, ruleName, source, messagePart)` in
    `shared/helpers_test.go`. Family-specific virtual filenames can be
    passed in. Removes 3x near-duplicate helper definitions.
