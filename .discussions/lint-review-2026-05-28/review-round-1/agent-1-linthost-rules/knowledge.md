# Agent 1 — linthost rule implementations: knowledge base

Scope reviewed: `packages/lint/linthost/*.go` rule files (focus on the
`rules_unicorn_*.go` family and a sample of the cross-family rules / shared
helpers). The directory holds ~210 `rules_*.go` files. I read ~40 files in
full and grep-sampled across all of them; findings below cite exact paths
and line ranges so the lead can verify.

## Files read in full

- `ast_helpers.go` — shared helpers: `nodeText`, `keywordStart`,
  `findKeyword`, `stripParens`, `identifierText`, `isMatchingPropertyAccess`,
  `numericLiteralText`, `stringLiteralText`, `walkDescendants`,
  `assignmentTargetNames`, `isLiteralLike`, `isLiteralExpression`,
  `isLiteralBoolean`, `isIdentifierPart`, `tokenRange`, `callCalleeName`.
- `engine.go` (head) — Rule interface, Context, Report/ReportFix/ReportRange,
  Engine/registry plumbing. (Engine internals are out of scope but the
  Rule-side contract is here.)
- `dispatch.go` — subcommand dispatcher.
- `rule_names.go` — `eslint/` prefix normalization.
- `rules_logic.go` — eqeqeq, noConstantCondition, noCondAssign, useIsNaN,
  validTypeof, noCompareNegZero, noUnsafeNegation, noExtraBooleanCast.
- `rules_dupes.go` — noDuplicateCase, noDupeKeys, noDupeArgs.
- `rules_problems.go` (tail) — hasModifier / hasAsyncModifier / noObjCalls.
- Unicorn family (full reads): `rules_unicorn_throw_new_error.go`,
  `rules_unicorn_no_null.go`, `rules_unicorn_no_new_buffer.go`,
  `rules_unicorn_no_process_exit.go`, `rules_unicorn_no_typeof_undefined.go`,
  `rules_unicorn_prefer_array_some.go`, `rules_unicorn_prefer_includes.go`,
  `rules_unicorn_no_array_for_each.go`, `rules_unicorn_no_array_reduce.go`,
  `rules_unicorn_consistent_destructuring.go`,
  `rules_unicorn_consistent_function_scoping.go`,
  `rules_unicorn_consistent_template_literal_escape.go`,
  `rules_unicorn_better_regex.go`, `rules_unicorn_string_content.go`,
  `rules_unicorn_import_style.go`, `rules_unicorn_template_indent.go`,
  `rules_unicorn_filename_case.go`, `rules_unicorn_isolated_functions.go`,
  `rules_unicorn_no_unused_properties.go`,
  `rules_unicorn_no_unnecessary_polyfills.go`,
  `rules_unicorn_switch_case_break_position.go`,
  `rules_unicorn_no_useless_length_check.go`,
  `rules_unicorn_no_useless_undefined.go`,
  `rules_unicorn_prefer_string_starts_ends_with.go`,
  `rules_unicorn_prefer_dom_node_remove.go`,
  `rules_unicorn_consistent_assert.go`,
  `rules_unicorn_consistent_empty_array_spread.go`,
  `rules_unicorn_consistent_date_clone.go`,
  `rules_unicorn_consistent_existence_index_check.go`,
  `rules_unicorn_prefer_array_find.go`,
  `rules_unicorn_prefer_array_index_of.go`,
  `rules_unicorn_prefer_array_flat.go`,
  `rules_unicorn_prefer_array_flat_map.go`,
  `rules_unicorn_prefer_at.go`,
  `rules_unicorn_prefer_set_has.go`,
  `rules_unicorn_prefer_set_size.go`,
  `rules_unicorn_prefer_modern_math_apis.go`,
  `rules_unicorn_prefer_math_min_max.go`,
  `rules_unicorn_prefer_default_parameters.go`,
  `rules_unicorn_prefer_global_this.go`,
  `rules_unicorn_prefer_module.go`,
  `rules_unicorn_prefer_top_level_await.go`,
  `rules_unicorn_prefer_export_from.go`,
  `rules_unicorn_prefer_string_slice.go`,
  `rules_unicorn_prefer_string_replace_all.go`,
  `rules_unicorn_prefer_string_raw.go`,
  `rules_unicorn_prefer_classlist_toggle.go`,
  `rules_unicorn_prefer_optional_catch_binding.go`,
  `rules_unicorn_no_lonely_if.go`, `rules_unicorn_no_nested_ternary.go`,
  `rules_unicorn_no_negated_condition.go`,
  `rules_unicorn_no_negation_in_equality_check.go`,
  `rules_unicorn_no_object_as_default_parameter.go`,
  `rules_unicorn_no_unreadable_array_destructuring.go`,
  `rules_unicorn_no_unreadable_iife.go`,
  `rules_unicorn_no_unnecessary_array_flat_depth.go`,
  `rules_unicorn_no_unnecessary_await.go`,
  `rules_unicorn_no_useless_spread.go`,
  `rules_unicorn_no_useless_iterator_to_array.go`,
  `rules_unicorn_no_useless_collection_argument.go`,
  `rules_unicorn_no_useless_promise_resolve_reject.go`,
  `rules_unicorn_no_useless_switch_case.go`,
  `rules_unicorn_no_useless_fallback_in_spread.go`,
  `rules_unicorn_no_array_callback_reference.go`,
  `rules_unicorn_no_array_method_this_argument.go`,
  `rules_unicorn_no_array_reverse.go`,
  `rules_unicorn_no_immediate_mutation.go`,
  `rules_unicorn_no_instanceof_builtins.go`,
  `rules_unicorn_no_static_only_class.go`,
  `rules_unicorn_no_named_default.go`,
  `rules_unicorn_no_anonymous_default_export.go`,
  `rules_unicorn_no_for_loop.go`,
  `rules_unicorn_no_thenable.go`,
  `rules_unicorn_no_hex_escape.go`,
  `rules_unicorn_no_zero_fractions.go`,
  `rules_unicorn_no_console_spaces.go`,
  `rules_unicorn_no_invalid_fetch_options.go`,
  `rules_unicorn_no_invalid_remove_event_listener.go`,
  `rules_unicorn_no_accessor_recursion.go`,
  `rules_unicorn_escape_case.go`,
  `rules_unicorn_explicit_length_check.go`,
  `rules_unicorn_expiring_todo_comments.go`,
  `rules_unicorn_catch_error_name.go`,
  `rules_unicorn_relative_url_style.go`,
  `rules_unicorn_prefer_event_target.go`,
  `rules_unicorn_prevent_abbreviations.go`.

## Patterns learned (what a clean rule looks like here)

A typical `rules_unicorn_*.go` (and most non-unicorn) rule:

1. Top-of-file block comment with a short policy paragraph, a paragraph
   describing the AST shape it matches, and the upstream docs URL.
2. Optional package-private `var <ruleName>X = map[string]struct{}{…}` for
   name allow/deny sets.
3. A zero-sized `type X struct{}` rule type.
4. Three methods: `Name() string`, `Visits() []shimast.Kind`,
   `Check(ctx *Context, node *shimast.Node)`.
5. `Check` uses `node.AsXxx()` casts, returns early on every nil, uses
   `stripParens`, `identifierText`, `numericLiteralText`,
   `stringLiteralText`, `isMatchingPropertyAccess` from `ast_helpers.go`
   rather than re-implementing locally.
6. `ctx.Report(node, "<message>.")` — one or two sentences, ends with a
   period. `ctx.ReportFix(node, msg, edits...)` when an autofix is offered.
7. `func init() { Register(<rule>{}) }` at the bottom.
8. Style: tabs in unicorn files; two-space indent in the older
   `rules_logic.go` / `rules_problems.go` / `rules_dupes.go`. Comment
   bodies start with `// <RuleName>:` in unicorn rules; older rules use
   `// <ruleType>:`. Mixed but stable per file.

Stub rules (MVP / no-op):

- File-level comment opens with `// MVP:` or `// Escape-hatch / no-op port:`.
- `Visits()` returns `[]shimast.Kind{shimast.KindSourceFile}` or `nil`.
- `Check` body is empty.
- Several have the matching test fixture marked `@ttsc-corpus-skip`.

## Findings — high confidence

- **rules_unicorn_no_useless_collection_argument.go:37-40** — Reports on
  `new Set()` / `new Map()` / `new WeakSet()` / `new WeakMap()` with ZERO
  arguments. Zero arguments is the canonical correct form; upstream and
  every reasonable port flag only present-but-useless arguments
  (`new Set(null)`, `new Set([])`). The current code message even says
  "Don't pass a useless initializer" — but at line 37, no initializer is
  passed. This will fire on every `new Set()` in the codebase. The early
  return path should be `len(.Arguments.Nodes) == 0 { return }`, not
  Report.

- **rules_unicorn_no_unreadable_array_destructuring.go:58** — Threshold is
  `run >= 3`. Upstream `no-unreadable-array-destructuring` flags
  `[, , foo]` (two holes) as unreadable. Threshold should almost certainly
  be `>= 2`, not `>= 3`. The header comment claims "three or more" which
  matches the code but contradicts upstream's documented examples.

- **rules_unicorn_no_negation_in_equality_check.go:37-38** — Calls
  `stripParens(bin.Left)` before checking for `!`. That means
  `(!a) === b` — the explicit-parens form the rule's own message tells
  authors to write ("or wrap in parens") — still fires. The strip must be
  reversed: the rule should match `!a === b` only when `bin.Left` is
  itself the PrefixUnary, not when it's a ParenthesizedExpression.

- **rules_unicorn_prefer_includes.go:84-89** — `<` and `>=` cases use the
  swap-side helper. For `0 < indexOf(x)` the swapped call passes
  `callSide = indexOf(x)`, `literalSide = 0`, `op = KindLessThanToken`,
  and the helper at line 84-85 treats it as the canonical
  `indexOf(x) < 0` shape. But `0 < indexOf(x)` is "found at index >= 1",
  not an existence check. Same for `0 >= indexOf(x)` (would match
  `indexOf(x) >= 0`). The orientation logic needs to handle the swap
  symmetrically only for the symmetric operators (`===`, `!==`, `==`,
  `!=`), not the asymmetric `<`/`>=`/`>`.

- **rules_unicorn_consistent_existence_index_check.go:46-47** — Same
  orientation bug as `prefer-includes`. `<` and `>=` are asymmetric; the
  swap-side call accepts both orderings and so falsely flags
  `0 < arr.indexOf(x)` (which means "found, not at slot 0", a different
  predicate from "found at all").

- **rules_unicorn_consistent_assert.go** — Whole rule is the wrong
  semantics for `unicorn/consistent-assert`. Upstream's
  `consistent-assert` is about the node:assert import shape (`assert(...)`
  function-call vs `assert.ok(...)` method-call). This implementation
  flags `assert.equal` / `assert.notEqual` and recommends the strict
  variant — that's a completely different rule. The matching message also
  refers to `strictEqual`. Either the rule was misnamed or its body is the
  wrong body for the name on the file.

- **rules_unicorn_no_useless_length_check.go:38-60** — The set of
  `unicornNoUselessLengthCheckMethods` contains `"every"`. With `&&`,
  `arr.length > 0 && arr.every(p)` is NOT equivalent to `arr.every(p)` —
  the empty-array case returns `true` from `every`, so the length check
  IS load-bearing. Upstream `no-useless-length-check` flags `every` only
  inside `||` chains (positive empty-array passthrough), not `&&`. The
  rule conflates the two semantic directions. Either remove `every` from
  the set or split the rule by parent operator (`&&` skips `every`/`||`
  skips `some`/`forEach`/`map`/`filter`).

- **rules_unicorn_no_useless_fallback_in_spread.go:25-67** — Fires on
  every `SpreadElement` including call-argument spread (`fn(...x ?? [])`).
  Spreading `null` or `undefined` into call arguments throws TypeError at
  runtime — it is NOT a no-op there. Only object-literal and
  array-literal spread positions are safe to flag. The Visits list should
  still include SpreadElement, but the parent kind needs to be checked
  before reporting: ArrayLiteralExpression for SpreadElement,
  ObjectLiteralExpression for SpreadAssignment.

- **rules_unicorn_no_for_loop.go:30-33** — Condition matching accepts any
  RHS of `<` so `for (let i = 0; i < n; i++)` with a bare counter is
  flagged. Upstream requires the condition to be `i < arr.length` AND the
  body to use `arr[i]`. The current implementation will misfire on every
  counter-based `for` loop, including ones that never index an array.

- **rules_unicorn_no_useless_undefined.go:37 and :48** — The two diagnostic
  messages are identical and broken: `"bare \`return;\` and \`return;\`
  have the same effect."` reads as `return; == return;` rather than
  conveying `return undefined; == return;`. Probably wanted
  `"\`return undefined;\` and bare \`return;\` have the same effect."`.

- **rules_unicorn_prefer_optional_catch_binding.go:44** — The "binding is
  unused" test is `strings.Contains(nodeText(file, catch.Block), name)`.
  For `name == "e"`, this matches every identifier containing the letter
  `e` (essentially everything). The rule will almost never fire when
  binding is `e`. Even for `error`, any identifier containing the
  substring "error" (`errorMessage`, `errorHandler`, `errors`) wrongly
  blocks the report. Needs identifier-aware traversal or, at minimum, a
  word-boundary regex.

- **rules_unicorn_expiring_todo_comments.go:65-72** — Inverted semantics
  vs upstream. Upstream `expiring-todo-comments` warns on TODOs whose
  bracketed condition has expired and validates the condition format; it
  does not WARN on bare TODOs without a condition. The ttsc port flags
  every TODO/FIXME/XXX that lacks a `[` annotation. Possibly an
  intentional ttsc policy choice — but the message and the upstream URL
  imply the upstream rule's behavior. Either the rule is misnamed (it's
  closer to a `require-todo-expiry` rule) or its trigger is inverted.

- **rules_unicorn_no_useless_fallback_in_spread.go** — Comment on line 7
  says "array spread or call argument spread" — the comment itself
  acknowledges including call-arg spread, but that's the bug above. Comment
  and behavior agree, but the behavior is wrong.

- **rules_unicorn_no_array_reverse.go**, **rules_unicorn_no_array_sort.go**,
  **rules_unicorn_no_immediate_mutation.go** — The URL header in each
  file points to
  `sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-array-reverse.md`
  / `no-array-sort.md` / `no-immediate-mutation.md`. None of those rule
  names exist in the public eslint-plugin-unicorn. These appear to be
  invented rules. The lead should either rename them (e.g. to
  `prefer-array-to-reversed`, `prefer-array-to-sorted`) or remove the
  upstream-docs links.

## Findings — medium confidence (need lead verification)

- **rules_unicorn_prefer_array_flat_map.go:21-44** — Does not check that
  `.flat()` is called with no argument or with `1`. `arr.map(fn).flat(2)`
  is NOT equivalent to `arr.flatMap(fn)`. False positive when an explicit
  depth > 1 is passed.

- **rules_unicorn_prefer_modern_math_apis.go:23-53** — Only matches
  `Math.log(x) * Math.LOG10E` with the call on the LEFT and the constant
  on the RIGHT. `*` is commutative, so `Math.LOG10E * Math.log(x)` is the
  same pattern. False negative on the swapped form. Also missing the
  `Math.log(x) / Math.LN10` shape (the division identity also produces
  `Math.log10`) and the `Math.sqrt(x*x + y*y) → Math.hypot(x, y)`
  shape upstream covers.

- **rules_unicorn_prefer_string_starts_ends_with.go:109** — Compares
  `len(stringLiteralText(literalSide)) == wantLen`. `len()` is byte
  length; non-ASCII string literals will mismatch (`"é"` is 2 bytes / 1
  char, so `s.slice(0,1) === "é"` won't match). Probably acceptable
  conservatism (false negative for non-ASCII), but worth documenting in
  the file comment.

- **rules_unicorn_no_hex_escape.go:22** and
  **rules_unicorn_escape_case.go:27-31** — Regexes don't track preceding
  backslash count. `"\\xFF"` (escaped backslash + literal "xFF") would be
  matched as a hex escape, but it's not. False positive on
  even-backslash-count cases. Same issue in escape-case.

- **rules_unicorn_prefer_string_replace_all.go** — Fires on every
  `.replace(/<anything>/g, x)`. Upstream restricts to patterns whose
  source is a single literal — `/[abc]/g`, `/a|b/g`, `/a+/g`, `/^a/g`
  CANNOT be safely converted to `.replaceAll(string)`. False positive on
  any regex with metacharacters.

- **rules_unicorn_no_useless_iterator_to_array.go:27-58** — Fires on every
  `[...x.entries()]` regardless of whether the parent is an iteration
  consumer. `const arr = [...x.entries()]; arr[0]` would be flagged, but
  the developer actually wants the materialized array. Upstream restricts
  to spread results used in for-of / spread / destructuring positions.

- **rules_unicorn_prefer_set_has.go** — Fires on every
  `[…].includes(x)` literal even when called once. Upstream restricts to
  array-literal references used in a loop. Header acknowledges this is an
  MVP, but the message will still mislead a user who calls
  `[1,2,3].includes(x)` once.

- **rules_unicorn_prevent_abbreviations.go:78-86** — Hot-path concern.
  `KindIdentifier` is one of the highest-frequency AST kinds. The Check
  calls `strings.ToLower(name)` on every identifier in the file, which
  allocates for each call. The dictionary has ~40 entries. A pre-filter
  on the first character or a `len(name) <= 6` check (every dictionary
  entry is short) would skip 90%+ of identifiers before the lowercase
  allocation. The rule also fires on identifiers in non-declaration
  positions (property accesses on third-party APIs, import names from
  external libs, type references), which is a separate false-positive
  problem.

- **rules_unicorn_no_accessor_recursion.go:36-51** — `walkDescendants`
  descends through nested functions inside the accessor body. A getter
  that returns an inner function whose body reads `this.value` (where
  `this` is the inner function's `this`, not the class's) will be falsely
  flagged. Need to short-circuit at FunctionDeclaration /
  FunctionExpression / MethodDeclaration boundaries (ArrowFunction is OK
  because it captures outer `this`).

- **rules_unicorn_no_thenable.go** — Fires on `then` property declarations
  inside class bodies too (KindMethodDeclaration is in the Visits list).
  Upstream restricts to object-literal context AND class-member context
  for properties named `then`. It's debatable whether `class
  PromiseAdapter { then() {} }` should fire (it's an intentional thenable
  implementation). Worth a config option.

- **rules_unicorn_no_static_only_class.go:23-46** — Doesn't check for
  `extends` heritage. A static-only class that extends a base
  (`class StaticConfig extends Base { static x = 1 }`) cannot be flattened
  to a plain object — the inheritance is the reason it's a class. Add an
  `if hasHeritage(node) { return }` gate.

- **rules_unicorn_no_console_spaces.go:48-55** — Reports leading-space on
  the first argument and trailing-space on the last argument. Those
  positions are not concatenation seams (the runtime joins arg-N's end
  with arg-N+1's start). Upstream flags only leading on non-first /
  trailing on non-last. Minor false-positive band.

- **rules_unicorn_prefer_string_raw.go:30-39** — Fires on every literal
  containing `\\` but doesn't check for OTHER escape sequences. `"\\n"`
  flagged → suggesting `String.raw\`\\n\`` would change meaning if the
  literal already had `\\n` (a backslash followed by literal `n`)
  intended as a newline. Underspecified.

- **rules_unicorn_no_nested_ternary.go** — Header claims "fires on every
  nested level rather than only the outermost — each inner conditional is
  its own offense", but the implementation reports on the OUTER node when
  its branch is a nested conditional. Either the header comment is
  misleading or the implementation under-reports. Also: does not check
  `cond.Condition` for a nested ternary — `(a ? b : c) ? x : y` is
  flagged by upstream but not here.

- **rules_unicorn_explicit_length_check.go:78-82** — Reports
  `xs.length ?? defaultValue` as a boolean context. `length` is never
  nullish, so `??` is meaningless on it — but it's also not a boolean
  context. The diagnostic message ("Use explicit comparison") doesn't fit
  the `??` case. Drop `KindQuestionQuestionToken` from the operator
  switch.

- **rules_unicorn_prefer_default_parameters.go** — Only matches
  `param = param ?? literal`. Upstream also handles
  `param === undefined ? literal : param` (the explicit ternary form) and
  some classic `if (param === undefined) param = literal` shape. The
  header explicitly opts out of these — flag as a known gap rather than a
  bug.

- **rules_dupes.go:107-153** — `staticPropertyKey` keys the getter and
  setter behind `get:`/`set:` prefixes but the regular data property has
  no prefix. So `{foo: 1, get foo() {…}}` produces keys
  `"foo"` and `"get:foo"` — not detected as duplicate keys, but at
  runtime the later getter overrides the earlier data property and ESLint
  does flag this combination. Minor / debatable.

## Suspected missing options or behaviors vs upstream

- **unicorn/catch-error-name** — Upstream supports `name` (default
  `"error"`) and `ignore` (regex array). Ttsc hardcodes `"error"`. No
  `DecodeOptions` call in the file.

- **unicorn/relative-url-style** — Upstream supports `"always"` vs
  `"never"`. Ttsc only implements `"never"` (no leading `./`). The header
  comment frames it as a single-direction rule.

- **unicorn/prefer-includes** — Upstream supports a `comparisons` option
  for additional shapes. Ttsc hardcodes the canonical six.

- **unicorn/prevent-abbreviations** — Upstream supports `replacements`,
  `extendDefaultReplacements`, `allowList`, `checkProperties`,
  `checkVariables`, etc. Ttsc uses a single hardcoded dictionary.

- **unicorn/import-style**, **unicorn/string-content**,
  **unicorn/template-indent**, **unicorn/filename-case**,
  **unicorn/no-unnecessary-polyfills** — All are option-driven upstream
  and registered as no-op stubs here. Documented in header comments.

- **unicorn/expiring-todo-comments** — Upstream supports
  `terms`, `ignoreDatesOnPullRequests`, `allowWarningComments`,
  `ignore`, `date`. Ttsc has no options surface and inverted trigger.

- **unicorn/no-array-callback-reference** — Upstream covers `Promise.all`
  / `Promise.allSettled` / `Promise.race` / `Promise.any` for callback
  references too. Ttsc only covers `Array#` methods.

- **unicorn/prefer-array-find** — Upstream covers `.filter(…).shift()`,
  `.filter(…)?.[0]`, `.filter(…).find(…)`. Ttsc only handles `[0]`.

- **unicorn/prefer-at** — Upstream covers `.slice(-1)[0]`,
  `.slice(-1).pop()`, `String#charAt`. Ttsc only handles
  `arr[arr.length - N]`.

- **unicorn/prefer-array-index-of** — Upstream covers `findLastIndex`
  too. Ttsc misses it.

- **unicorn/no-useless-spread** — Upstream flags spread-clones,
  spread-as-call-args (`Math.max(...nums)`), spread in `for-of`.
  Ttsc only handles `[...lit]` and `{...lit}`.

- **unicorn/prefer-event-target** — Upstream also flags
  `class Foo extends EventEmitter`. Ttsc only flags
  `new EventEmitter()`.

## Candidate proposals (to surface in discussion)

1. Fix `no-useless-collection-argument`: change line 37-40 in
   `rules_unicorn_no_useless_collection_argument.go` to `return` on zero
   arguments instead of Report. (Likely a copy-paste inversion.)

2. Fix `no-unreadable-array-destructuring` threshold: change `run >= 3`
   to `run >= 2` and update the file header.

3. Fix the orientation bug in `prefer-includes` and
   `consistent-existence-index-check`: only call the swap-side helper
   for symmetric operators; handle `<` / `>=` / `>` on the original
   orientation only.

4. Fix `no-negation-in-equality-check`: don't `stripParens(bin.Left)`
   before the `!` check — explicit parens are the documented escape
   hatch.

5. Audit `consistent-assert`: either rename the rule to match its
   `equal → strictEqual` behavior or rewrite the body to match the real
   upstream `consistent-assert` (node:assert call style).

6. Audit `no-array-reverse`, `no-array-sort`, `no-immediate-mutation`:
   the upstream URLs in the headers don't resolve to real rules. Either
   the rules should be removed, or the URLs should point at the ttsc-only
   docs page.

7. Split `no-useless-length-check` by parent operator: skip `every` for
   `&&` and skip `some`/`forEach`/`map`/`filter` for `||`.

8. Restrict `no-useless-fallback-in-spread` to spread positions inside
   array / object literals; reject SpreadElement whose parent is a
   CallExpression.

9. Tighten `no-for-loop` condition matching: require the RHS of `<` to be
   a `.length` access (and ideally check the body for `arr[i]`).

10. Replace the substring-based unused-binding check in
    `prefer-optional-catch-binding` with an identifier walk (or at least a
    word-boundary regex).

11. Document/decide the `expiring-todo-comments` policy: either match
    upstream (warn only on expired conditions) or rename the rule and
    update its docs link.

12. Add `extends` and (optionally) constructor-with-side-effects gates to
    `no-static-only-class`.

13. Constrain `prefer-string-replace-all` to literal-content regex
    patterns (no metacharacters) — refine
    `unicornPreferStringReplaceAllHasGlobalFlag` into a full
    `isLiteralReplaceablePattern` helper.

14. Restrict `no-useless-iterator-to-array` to spreads used in
    iteration-consuming positions (for-of, spread, destructuring,
    function-call spread).

15. Fix the duplicate-error-message typo in `no-useless-undefined`
    (the diagnostic refers to `return; and return;` twice).

16. Add an option surface for `catch-error-name` (name + ignore regex)
    using `ctx.DecodeOptions`.

17. Performance: in `prevent-abbreviations`, short-circuit on
    `len(name) > 6` (longest dictionary entry) and on first-character
    set before the `strings.ToLower` allocation.

18. Constrain `no-accessor-recursion` walk to not descend into nested
    non-arrow function / method bodies.

19. Match the swap orientation of `prefer-modern-math-apis` so
    `Math.LOG10E * Math.log(x)` is also flagged; consider adding the
    `Math.log(x) / Math.LN10` and `Math.hypot` shapes.

20. Constrain `prefer-array-flat-map` to `.flat()` calls without an
    argument (or with `1`).
