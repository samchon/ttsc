# Agent 3 Knowledge: packages/lint

Scope read:
- `packages/lint/linthost`: engine, command dispatch, compile/host bootstrap, config loading/cache/globs, format resolver, fix cascade/edit selection, inline directives, printer/doc engine, format rules, lint rules, contributor adapter, and AST helpers.
- `packages/lint/rule`: public contributor API and `rule/astutil` helpers.
- `packages/lint/plugin`: native command wrapper.
- `packages/lint/src`: plugin descriptor factory, contributor config discovery/evaluation/cache, structures, and default format exports.
- Related Go tests under `packages/lint/test/{command,config,engine,fix,format,plugin,printer,rules}`. The package-local Go runner flattens these tests into a scratch `linthost` module.

Architecture notes:
- The lint engine is pure per-file AST dispatch. It binds one `Context` per `(file, rule)`, deduplicates duplicate `Visits` kinds, parallelizes AST-only file walks, and serializes type-aware runs.
- Config is flat-entry based: ignore-only entries short-circuit, later matching entries shadow earlier rules, and `format` blocks expand into `format/*` rule options with default severity off.
- `ttsc format` wraps the resolver to promote configured format rules to `warn`, then applies only `FormatRule` fixes in a bounded cascade.
- `ttsc fix` applies lint and format fixes, reloads the Program after each pass, then performs a final diagnostic pass.
- Public contributor rules register through `packages/lint/rule`, are adapted into internal rules, and conservatively require the type checker.

Concrete proposals:
1. Fix the `no-loss-of-precision` exact-boundary miss.
   - Evidence: `packages/lint/linthost/rules_problems.go:219` says `9007199254740992` is the first unsafe integer, but `packages/lint/linthost/rules_problems.go:221` sets `maxSafe` to that value and `packages/lint/linthost/rules_problems.go:228` uses `>`, so the exact first unsafe value is not reported. Current corpus coverage only checks `9007199254740993` at `packages/lint/test/rules/runtime-safety/no_loss_of_precision_test.go:19`.
   - Change: compare against `9007199254740991` with `>`, or keep `9007199254740992` and use `>=`; add a fixture for `9007199254740992`.
   - Risk: low.
   - Validation: `node scripts/test-go-lint.cjs` after adding the boundary fixture.

2. Preserve source file permissions when applying fixes.
   - Evidence: `packages/lint/linthost/fix.go:222` rewrites every edited source file with mode `0644`. Existing fix tests cover edit selection and source text, but `packages/lint/test/fix` has no permission-preservation test.
   - Change: `os.Stat` the target before writing and pass the existing `Mode().Perm()` to `os.WriteFile`, falling back to `0644` only when stat fails.
   - Risk: low.
   - Validation: add one `applyTextEditsToFile` permission test, then run `node scripts/test-go-lint.cjs`.

3. Make inline-disable range filtering single-pass.
   - Evidence: `filterInlineDisabledFindings` loops all findings at `packages/lint/linthost/directives.go:86`, and each `suppresses` call replays all directive events from the start at `packages/lint/linthost/directives.go:213`. The engine appends findings in source walk order per file at `packages/lint/linthost/engine.go:465` and filters once at `packages/lint/linthost/engine.go:480`.
   - Change: scan findings in position order and advance the directive event state once, preserving original output order or doing a stable position sort before filtering.
   - Risk: medium; `enable`/`disable all` interactions are subtle.
   - Validation: `node scripts/test-go-lint.cjs`, with focused attention on `packages/lint/test/engine/engine_respects_*disable*`.

4. Precompile config glob patterns once per config entry.
   - Evidence: every `ResolveRules` call walks entries at `packages/lint/linthost/config.go:237` and `packages/lint/linthost/config.go:243`; matching normalizes, expands braces, splits parts, and recursively evaluates `**` on every call at `packages/lint/linthost/config.go:1540`, `packages/lint/linthost/config.go:1577`, and `packages/lint/linthost/config.go:1675`.
   - Change: store normalized/brace-expanded/split pattern parts on parsed `ConfigEntry` or in a private matcher cache inside `ConfigStore`.
   - Risk: medium; glob semantics must stay byte-for-byte compatible.
   - Validation: `node scripts/test-go-lint.cjs`, especially config external glob tests such as `packages/lint/test/config/external/match_any_pattern_handles_brace_expansion_test.go`.

5. Cache `formatCommandResolver` format-option rule names.
   - Evidence: `ResolveRules`, `ActiveRuleNames`, and `EnabledRuleConfig` all call `formatOptionRuleNames` at `packages/lint/linthost/format.go:139`, `packages/lint/linthost/format.go:221`, and `packages/lint/linthost/format.go:234`; the helper re-extracts options and sorts names each time at `packages/lint/linthost/format.go:250`.
   - Change: compute the sorted format-option names once when constructing the resolver, or use a pointer receiver with `sync.Once`.
   - Risk: low.
   - Validation: `node scripts/test-go-lint.cjs`, covering `packages/lint/test/format/format_command_resolver_*`.

6. Remove quadratic comment-mask scans in print-width safety checks.
   - Evidence: `hasNonChildComments` linearly checks all child spans for every byte at `packages/lint/linthost/rules_format_print_width.go:566`; `blockHasNonStatementComment` does the same over statement spans at `packages/lint/linthost/print_nodes_function.go:247`. Both are on formatter hot paths and already have comment-preservation tests.
   - Change: because child/statement ranges are source ordered, scan only gaps between ranges or advance a span index while scanning bytes.
   - Risk: low to medium; the conservative abstain behavior must remain.
   - Validation: `node scripts/test-go-lint.cjs`, especially `packages/lint/test/format/format_print_width_abstains_when_*comment*` and `packages/lint/test/printer/block_has_non_statement_comment_*`.

7. Avoid whole-file AST scans per import in `consistent-type-imports`.
   - Evidence: each import declaration builds local names at `packages/lint/linthost/rules_ts_extra.go:488` and calls `allUsesAreTypeOnly(ctx.File.AsNode(), names)` at `packages/lint/linthost/rules_ts_extra.go:504`; that helper walks the whole file at `packages/lint/linthost/rules_ts_extra.go:521`. A file with many imports repeats the same AST walk many times.
   - Change: compute one per-file identifier use classification for this rule, or cache file-level value-use names for the duration of the rule pass.
   - Risk: medium; duplicate local names and type-query cases must preserve current heuristic behavior.
   - Validation: `node scripts/test-go-lint.cjs`, including `packages/lint/test/rules/imports-modules/consistent_type_imports_violation_test.go`.

Validation run:
- `node scripts/test-go-lint.cjs` passed (`ok github.com/samchon/ttsc/packages/lint/linthost 3.635s`).

No product source was edited in this agent pass.
