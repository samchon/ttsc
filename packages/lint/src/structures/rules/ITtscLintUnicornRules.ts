import type { TtscLintRuleSetting } from "../TtscLintRuleSetting";

/**
 * Modernization and style rules from `eslint-plugin-unicorn`.
 *
 * Span array iteration, string and regex idioms, Node.js APIs, error handling,
 * module syntax, DOM APIs, and code shape. Rewrite legacy patterns into modern
 * counterparts, forbid known anti-patterns, and pin a consistent style for
 * things ESLint core and `typescript/*` leave underspecified.
 *
 * Pure-AST; no checker dependencies.
 *
 * @reference https://github.com/sindresorhus/eslint-plugin-unicorn
 */
export interface ITtscLintUnicornRules {
  /**
   * Rewrite regex literals into shorter, consistent, and safer form
   * (character-class shorthands, redundant ranges).
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/better-regex.md
   */
  "unicorn/better-regex"?: TtscLintRuleSetting;

  /**
   * Enforce a canonical parameter name (`error`) in `catch` clauses.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/catch-error-name.md
   */
  "unicorn/catch-error-name"?: TtscLintRuleSetting;

  /**
   * Enforce consistent assertion style when using `node:assert`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-assert.md
   */
  "unicorn/consistent-assert"?: TtscLintRuleSetting;

  /**
   * Prefer passing a `Date` directly to the `Date` constructor when cloning,
   * not `+date` or `date.getTime()`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-date-clone.md
   */
  "unicorn/consistent-date-clone"?: TtscLintRuleSetting;

  /**
   * Once a property is destructured from an object, require subsequent reads to
   * use the destructured binding.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-destructuring.md
   */
  "unicorn/consistent-destructuring"?: TtscLintRuleSetting;

  /**
   * Require both branches of a ternary spread inside an array literal to be
   * array-typed.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-empty-array-spread.md
   */
  "unicorn/consistent-empty-array-spread"?: TtscLintRuleSetting;

  /**
   * Enforce a consistent comparison form (`< 0` vs `=== -1`, `>= 0` vs `!==
   * -1`) for `indexOf` / `findIndex` existence checks.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-existence-index-check.md
   */
  "unicorn/consistent-existence-index-check"?: TtscLintRuleSetting;

  /**
   * Hoist function declarations to the highest scope that does not capture any
   * outer variables.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-function-scoping.md
   */
  "unicorn/consistent-function-scoping"?: TtscLintRuleSetting;

  /**
   * Enforce a consistent style (always `\${` or always `$\{`) when escaping
   * `${` in template literals.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-template-literal-escape.md
   */
  "unicorn/consistent-template-literal-escape"?: TtscLintRuleSetting;

  /**
   * Require user-defined `Error` subclasses to set `name`, call
   * `super(message)`, and assign their stack correctly.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/custom-error-definition.md
   */
  "unicorn/custom-error-definition"?: TtscLintRuleSetting;

  /**
   * Reject whitespace inside empty `{}` braces.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/empty-brace-spaces.md
   */
  "unicorn/empty-brace-spaces"?: TtscLintRuleSetting;

  /**
   * Require a non-empty `message` argument when constructing a built-in
   * `Error`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/error-message.md
   */
  "unicorn/error-message"?: TtscLintRuleSetting;

  /**
   * Require consistent case for escape sequences (`\xA9` over `\xa9`, `\u00B5`
   * over `\u00b5`).
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/escape-case.md
   */
  "unicorn/escape-case"?: TtscLintRuleSetting;

  /**
   * Require every `TODO`/`FIXME`/`XXX` comment to declare an expiration date or
   * package version.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/expiring-todo-comments.md
   */
  "unicorn/expiring-todo-comments"?: TtscLintRuleSetting;

  /**
   * Require explicit comparison of `.length` / `.size` instead of relying on
   * truthy coercion.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/explicit-length-check.md
   */
  "unicorn/explicit-length-check"?: TtscLintRuleSetting;

  /**
   * Enforce a single case style (kebab / camel / snake / pascal) for source
   * filenames.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/filename-case.md
   */
  "unicorn/filename-case"?: TtscLintRuleSetting;

  /**
   * Restrict each module's allowed import styles (named only, default only,
   * namespace only).
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/import-style.md
   */
  "unicorn/import-style"?: TtscLintRuleSetting;

  /**
   * Reject references to outer-scope variables inside functions marked as
   * isolated (e.g., the body of a web worker).
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/isolated-functions.md
   */
  "unicorn/isolated-functions"?: TtscLintRuleSetting;

  /**
   * Require `new` when calling builtin constructors like `Error`, `Map`, `Set`,
   * `Date` — and forbid `new` on primitive wrappers like `String`, `Number`,
   * `Boolean`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/new-for-builtins.md
   */
  "unicorn/new-for-builtins"?: TtscLintRuleSetting;

  /**
   * Require every `eslint-disable*` directive to name the rules it disables.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-abusive-eslint-disable.md
   */
  "unicorn/no-abusive-eslint-disable"?: TtscLintRuleSetting;

  /**
   * Reject recursive reads on `this.<prop>` inside the getter / setter for
   * `<prop>`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-accessor-recursion.md
   */
  "unicorn/no-accessor-recursion"?: TtscLintRuleSetting;

  /**
   * Require a name on every default-exported function, class, or object.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-anonymous-default-export.md
   */
  "unicorn/no-anonymous-default-export"?: TtscLintRuleSetting;

  /**
   * Reject passing a function reference directly as the callback to `map` /
   * `filter` / `forEach` / etc., which silently leaks extra index/array
   * arguments to the callee.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-array-callback-reference.md
   */
  "unicorn/no-array-callback-reference"?: TtscLintRuleSetting;

  /**
   * Prefer `for...of` over `Array.prototype.forEach`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-array-for-each.md
   */
  "unicorn/no-array-for-each"?: TtscLintRuleSetting;

  /**
   * Reject the second `thisArg` argument to array methods; use an explicit
   * closure instead.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-array-method-this-argument.md
   */
  "unicorn/no-array-method-this-argument"?: TtscLintRuleSetting;

  /**
   * Reject `Array#reduce` / `Array#reduceRight` in favor of explicit loops or
   * other helpers.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-array-reduce.md
   */
  "unicorn/no-array-reduce"?: TtscLintRuleSetting;

  /**
   * Prefer `Array#toReversed` over the mutating `Array#reverse`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-array-reverse.md
   */
  "unicorn/no-array-reverse"?: TtscLintRuleSetting;

  /**
   * Prefer `Array#toSorted` over the mutating `Array#sort`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-array-sort.md
   */
  "unicorn/no-array-sort"?: TtscLintRuleSetting;

  /**
   * Reject member access on an `await` expression without parens; require
   * `(await x).y`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-await-expression-member.md
   */
  "unicorn/no-await-expression-member"?: TtscLintRuleSetting;

  /**
   * Reject `await` inside arrays passed to `Promise.all` / `Promise.allSettled`
   * / `Promise.race` / `Promise.any` — the awaits serialize the calls.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-await-in-promise-methods.md
   */
  "unicorn/no-await-in-promise-methods"?: TtscLintRuleSetting;

  /**
   * Reject leading or trailing spaces in arguments to `console.log` and friends
   * — `console` already inserts spaces between args.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-console-spaces.md
   */
  "unicorn/no-console-spaces"?: TtscLintRuleSetting;

  /**
   * Reject direct reads or assignments to `document.cookie`; use the Cookie
   * Store API or a wrapper.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-document-cookie.md
   */
  "unicorn/no-document-cookie"?: TtscLintRuleSetting;

  /**
   * Reject source files whose only content is whitespace and/or comments.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-empty-file.md
   */
  "unicorn/no-empty-file"?: TtscLintRuleSetting;

  /**
   * Prefer `for...of` over index-based `for` loops over arrays.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-for-loop.md
   */
  "unicorn/no-for-loop"?: TtscLintRuleSetting;

  /**
   * Prefer Unicode escape (`\u00A9`) over hexadecimal escape (`\xA9`).
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-hex-escape.md
   */
  "unicorn/no-hex-escape"?: TtscLintRuleSetting;

  /**
   * Reject mutating a value on the same expression that produces it
   * (`[...x].push(y)`); separate the construction and the mutation.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-immediate-mutation.md
   */
  "unicorn/no-immediate-mutation"?: TtscLintRuleSetting;

  /**
   * Reject `instanceof Array`, `instanceof Error`, `instanceof Map`, etc. —
   * they fail across realms and for subclasses.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-instanceof-builtins.md
   */
  "unicorn/no-instanceof-builtins"?: TtscLintRuleSetting;

  /**
   * Reject GET / HEAD `fetch()` calls that also set a request `body`, which
   * throws at runtime.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-invalid-fetch-options.md
   */
  "unicorn/no-invalid-fetch-options"?: TtscLintRuleSetting;

  /**
   * Reject `removeEventListener` calls whose handler argument is a fresh
   * function reference and therefore matches no registered listener.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-invalid-remove-event-listener.md
   */
  "unicorn/no-invalid-remove-event-listener"?: TtscLintRuleSetting;

  /**
   * Reject identifiers that start with a reserved word (`newFoo`, `classBar`).
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-keyword-prefix.md
   */
  "unicorn/no-keyword-prefix"?: TtscLintRuleSetting;

  /**
   * Reject `if` as the only statement inside an `else` block; use `else if`
   * instead.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-lonely-if.md
   */
  "unicorn/no-lonely-if"?: TtscLintRuleSetting;

  /**
   * Reject magic-number depth arguments to `Array#flat`; require `Infinity` or
   * a named constant.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-magic-array-flat-depth.md
   */
  "unicorn/no-magic-array-flat-depth"?: TtscLintRuleSetting;

  /**
   * Reject re-importing or re-exporting a default binding under a name that
   * differs from the upstream binding.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-named-default.md
   */
  "unicorn/no-named-default"?: TtscLintRuleSetting;

  /**
   * Reject negated conditions in `if`/`else` and ternaries when the positive
   * form is shorter.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-negated-condition.md
   */
  "unicorn/no-negated-condition"?: TtscLintRuleSetting;

  /**
   * Reject `!a === b`; require `a !== b` or `!(a === b)`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-negation-in-equality-check.md
   */
  "unicorn/no-negation-in-equality-check"?: TtscLintRuleSetting;

  /**
   * Reject ternaries nested inside other ternaries.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-nested-ternary.md
   */
  "unicorn/no-nested-ternary"?: TtscLintRuleSetting;

  /**
   * Reject the `new Array(...)` constructor; use array literals or `Array.from`
   * / `Array.of`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-new-array.md
   */
  "unicorn/no-new-array"?: TtscLintRuleSetting;

  /**
   * Reject the deprecated `new Buffer()` constructor; use `Buffer.from` or
   * `Buffer.alloc`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-new-buffer.md
   */
  "unicorn/no-new-buffer"?: TtscLintRuleSetting;

  /**
   * Reject the `null` literal in favor of `undefined`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-null.md
   */
  "unicorn/no-null"?: TtscLintRuleSetting;

  /**
   * Reject inline object literals as default values for function parameters.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-object-as-default-parameter.md
   */
  "unicorn/no-object-as-default-parameter"?: TtscLintRuleSetting;

  /**
   * Reject `process.exit()`; throw or return a non-zero status instead.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-process-exit.md
   */
  "unicorn/no-process-exit"?: TtscLintRuleSetting;

  /**
   * Reject `Promise.all` / `Promise.race` / etc. called with a single-element
   * array; the wrapper is redundant.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-single-promise-in-promise-methods.md
   */
  "unicorn/no-single-promise-in-promise-methods"?: TtscLintRuleSetting;

  /**
   * Reject classes whose every member is `static`; use a plain module-level
   * namespace instead.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-static-only-class.md
   */
  "unicorn/no-static-only-class"?: TtscLintRuleSetting;

  /**
   * Reject defining a property named `then` on objects, modules, or classes —
   * `await` and Promise resolution accidentally invoke it.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-thenable.md
   */
  "unicorn/no-thenable"?: TtscLintRuleSetting;

  /**
   * Reject `const self = this` and similar aliases; capture via arrow functions
   * instead.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-this-assignment.md
   */
  "unicorn/no-this-assignment"?: TtscLintRuleSetting;

  /**
   * Reject `typeof x === "undefined"`; compare against `undefined` directly.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-typeof-undefined.md
   */
  "unicorn/no-typeof-undefined"?: TtscLintRuleSetting;

  /**
   * Reject `1` as the explicit depth argument of `Array#flat`; the default is
   * already `1`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unnecessary-array-flat-depth.md
   */
  "unicorn/no-unnecessary-array-flat-depth"?: TtscLintRuleSetting;

  /**
   * Reject `.length` / `Infinity` as the deleteCount argument to `splice` /
   * `toSpliced`; omit it to delete to the end.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unnecessary-array-splice-count.md
   */
  "unicorn/no-unnecessary-array-splice-count"?: TtscLintRuleSetting;

  /**
   * Reject `await` on non-thenable expressions.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unnecessary-await.md
   */
  "unicorn/no-unnecessary-await"?: TtscLintRuleSetting;

  /**
   * Reject polyfill imports for APIs already available in the project's
   * targeted Node / browser baseline.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unnecessary-polyfills.md
   */
  "unicorn/no-unnecessary-polyfills"?: TtscLintRuleSetting;

  /**
   * Reject `.length` / `Infinity` as the end argument to `slice`; omit it to
   * slice to the end.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unnecessary-slice-end.md
   */
  "unicorn/no-unnecessary-slice-end"?: TtscLintRuleSetting;

  /**
   * Reject destructuring patterns with long hole runs (`[,,,,a]`); use a named
   * index instead.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unreadable-array-destructuring.md
   */
  "unicorn/no-unreadable-array-destructuring"?: TtscLintRuleSetting;

  /**
   * Reject IIFEs whose nesting (multiple parens, arrow IIFE arguments) is hard
   * to read.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unreadable-iife.md
   */
  "unicorn/no-unreadable-iife"?: TtscLintRuleSetting;

  /**
   * Reject object properties that are never read after definition.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unused-properties.md
   */
  "unicorn/no-unused-properties"?: TtscLintRuleSetting;

  /**
   * Reject useless initializer arguments (`new Set()`, `new Map([])`, `new
   * Set(undefined)`) on collection constructors.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-collection-argument.md
   */
  "unicorn/no-useless-collection-argument"?: TtscLintRuleSetting;

  /**
   * Reject `Error.captureStackTrace(this, constructor)` when the surrounding
   * subclass relies on the default `Error` capture.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-error-capture-stack-trace.md
   */
  "unicorn/no-useless-error-capture-stack-trace"?: TtscLintRuleSetting;

  /**
   * Reject `...(x ?? {})` and similar fallbacks when spreading; the spread of
   * `null` / `undefined` is already a no-op.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-fallback-in-spread.md
   */
  "unicorn/no-useless-fallback-in-spread"?: TtscLintRuleSetting;

  /**
   * Reject `[...iterator]` / `Array.from(iterator)` when the iterator can be
   * consumed directly (e.g., inside `for...of`).
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-iterator-to-array.md
   */
  "unicorn/no-useless-iterator-to-array"?: TtscLintRuleSetting;

  /**
   * Reject `arr.length` checks that the iteration method itself already
   * handles.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-length-check.md
   */
  "unicorn/no-useless-length-check"?: TtscLintRuleSetting;

  /**
   * Reject `return Promise.resolve(x)` / `return Promise.reject(e)` inside
   * `async` functions — `return x` and `throw e` work identically.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-promise-resolve-reject.md
   */
  "unicorn/no-useless-promise-resolve-reject"?: TtscLintRuleSetting;

  /**
   * Reject spreading a single iterable into a new collection of the same kind
   * (`[...arr]`, `{...obj}`) when the original would suffice.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-spread.md
   */
  "unicorn/no-useless-spread"?: TtscLintRuleSetting;

  /**
   * Reject `case` clauses with an empty body that immediately precede a
   * `default` whose body executes for them.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-switch-case.md
   */
  "unicorn/no-useless-switch-case"?: TtscLintRuleSetting;

  /**
   * Reject explicit `undefined` returns, default initializers, and arguments
   * where the omission has the same meaning.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-undefined.md
   */
  "unicorn/no-useless-undefined"?: TtscLintRuleSetting;

  /**
   * Reject `1.0` / `1.` / `.5e0` in favor of `1`, `1`, and `0.5`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-zero-fractions.md
   */
  "unicorn/no-zero-fractions"?: TtscLintRuleSetting;

  /**
   * Enforce one consistent case for the prefix and digits of hex / binary /
   * octal literals (`0xFF` over `0xff`).
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/number-literal-case.md
   */
  "unicorn/number-literal-case"?: TtscLintRuleSetting;

  /**
   * Enforce `_` separator grouping (every 3 digits for decimal, every 4 for
   * hex) in numeric literals.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/numeric-separators-style.md
   */
  "unicorn/numeric-separators-style"?: TtscLintRuleSetting;

  /**
   * Prefer `addEventListener` / `removeEventListener` over assigning to `on*`
   * properties.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-add-event-listener.md
   */
  "unicorn/prefer-add-event-listener"?: TtscLintRuleSetting;

  /**
   * Prefer `Array#find` / `Array#findLast` over `filter(...)[0]` /
   * `filter(...).at(-1)`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-array-find.md
   */
  "unicorn/prefer-array-find"?: TtscLintRuleSetting;

  /**
   * Prefer `Array#flat` over legacy flattening idioms (`[].concat(...arrs)`,
   * `reduce` with `concat`).
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-array-flat.md
   */
  "unicorn/prefer-array-flat"?: TtscLintRuleSetting;

  /**
   * Prefer `Array#flatMap` over `map(...).flat()`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-array-flat-map.md
   */
  "unicorn/prefer-array-flat-map"?: TtscLintRuleSetting;

  /**
   * Prefer `indexOf` / `lastIndexOf` over `findIndex` / `findLastIndex` when
   * matching by `===`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-array-index-of.md
   */
  "unicorn/prefer-array-index-of"?: TtscLintRuleSetting;

  /**
   * Prefer `Array#some` over `filter(...).length > 0`, `find(...) !==
   * undefined`, and similar shapes.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-array-some.md
   */
  "unicorn/prefer-array-some"?: TtscLintRuleSetting;

  /**
   * Prefer `Array#at` / `String#at` over index arithmetic and `charAt`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-at.md
   */
  "unicorn/prefer-at"?: TtscLintRuleSetting;

  /**
   * Prefer `1n` over `BigInt(1)` and `BigInt("1")`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-bigint-literals.md
   */
  "unicorn/prefer-bigint-literals"?: TtscLintRuleSetting;

  /**
   * Prefer `Blob#arrayBuffer()` / `Blob#text()` over
   * `FileReader#readAsArrayBuffer` / `readAsText`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-blob-reading-methods.md
   */
  "unicorn/prefer-blob-reading-methods"?: TtscLintRuleSetting;

  /**
   * Prefer class field declarations over constructor assignments to `this.field
   * = value`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-class-fields.md
   */
  "unicorn/prefer-class-fields"?: TtscLintRuleSetting;

  /**
   * Prefer `Element#classList.toggle(name, condition)` over manual `add` /
   * `remove` branches.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-classlist-toggle.md
   */
  "unicorn/prefer-classlist-toggle"?: TtscLintRuleSetting;

  /**
   * Prefer `String#codePointAt` / `String.fromCodePoint` over `charCodeAt` /
   * `fromCharCode`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-code-point.md
   */
  "unicorn/prefer-code-point"?: TtscLintRuleSetting;

  /**
   * Prefer `Date.now()` over `new Date().getTime()` / `+new Date()`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-date-now.md
   */
  "unicorn/prefer-date-now"?: TtscLintRuleSetting;

  /**
   * Prefer default parameter syntax over `x = x ?? default` reassignments
   * inside the function body.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-default-parameters.md
   */
  "unicorn/prefer-default-parameters"?: TtscLintRuleSetting;

  /**
   * Prefer `Node#append` over `Node#appendChild`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-dom-node-append.md
   */
  "unicorn/prefer-dom-node-append"?: TtscLintRuleSetting;

  /**
   * Prefer `Element#dataset` over `getAttribute` / `setAttribute` for `data-*`
   * attributes.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-dom-node-dataset.md
   */
  "unicorn/prefer-dom-node-dataset"?: TtscLintRuleSetting;

  /**
   * Prefer `ChildNode#remove` over `parent.removeChild(child)`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-dom-node-remove.md
   */
  "unicorn/prefer-dom-node-remove"?: TtscLintRuleSetting;

  /**
   * Prefer `Node#textContent` over `HTMLElement#innerText`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-dom-node-text-content.md
   */
  "unicorn/prefer-dom-node-text-content"?: TtscLintRuleSetting;

  /**
   * Prefer `EventTarget` over Node's `EventEmitter` when the code is shared
   * between Node and the browser.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-event-target.md
   */
  "unicorn/prefer-event-target"?: TtscLintRuleSetting;

  /**
   * Prefer `export ... from` over importing-then-re-exporting in two
   * statements.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-export-from.md
   */
  "unicorn/prefer-export-from"?: TtscLintRuleSetting;

  /**
   * Prefer `globalThis` over `window`, `self`, and `global`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-global-this.md
   */
  "unicorn/prefer-global-this"?: TtscLintRuleSetting;

  /**
   * Prefer `import.meta.dirname` / `import.meta.filename` over `fileURLToPath`
   * workarounds.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-import-meta-properties.md
   */
  "unicorn/prefer-import-meta-properties"?: TtscLintRuleSetting;

  /**
   * Prefer `String#includes` / `Array#includes` over `indexOf(...) !== -1` and
   * `some(x => x === target)`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-includes.md
   */
  "unicorn/prefer-includes"?: TtscLintRuleSetting;

  /**
   * Prefer passing a `Buffer` directly to `JSON.parse` (Node 21+) instead of
   * decoding to a string first.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-json-parse-buffer.md
   */
  "unicorn/prefer-json-parse-buffer"?: TtscLintRuleSetting;

  /**
   * Prefer `KeyboardEvent#key` over the deprecated `KeyboardEvent#keyCode` /
   * `charCode` / `which`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-keyboard-event-key.md
   */
  "unicorn/prefer-keyboard-event-key"?: TtscLintRuleSetting;

  /**
   * Prefer `a || b` / `a ?? b` over the equivalent ternary `a ? a : b`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-logical-operator-over-ternary.md
   */
  "unicorn/prefer-logical-operator-over-ternary"?: TtscLintRuleSetting;

  /**
   * Prefer `Math.min` / `Math.max` over ternaries computing the same value.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-math-min-max.md
   */
  "unicorn/prefer-math-min-max"?: TtscLintRuleSetting;

  /**
   * Prefer `Math.trunc` over `~~x` / `x | 0` for integer truncation.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-math-trunc.md
   */
  "unicorn/prefer-math-trunc"?: TtscLintRuleSetting;

  /**
   * Prefer `before` / `after` / `replaceWith` over `insertBefore` /
   * `replaceChild` / `insertAdjacentText`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-modern-dom-apis.md
   */
  "unicorn/prefer-modern-dom-apis"?: TtscLintRuleSetting;

  /**
   * Prefer `Math.log10` / `Math.hypot` / `Math.log2` / `Math.cbrt` over their
   * legacy approximations.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-modern-math-apis.md
   */
  "unicorn/prefer-modern-math-apis"?: TtscLintRuleSetting;

  /**
   * Prefer ES modules (`import` / `export`) over CommonJS (`require` /
   * `module.exports` / `__dirname` / `__filename`).
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-module.md
   */
  "unicorn/prefer-module"?: TtscLintRuleSetting;

  /**
   * Prefer the bare `String` / `Number` / `Boolean` / `BigInt` functions over
   * `x => String(x)` arrow wrappers.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-native-coercion-functions.md
   */
  "unicorn/prefer-native-coercion-functions"?: TtscLintRuleSetting;

  /**
   * Prefer negative-index lookups (`arr.at(-1)`, `arr.slice(-2)`) over
   * `arr.length - 1` / `arr.length - 2` arithmetic.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-negative-index.md
   */
  "unicorn/prefer-negative-index"?: TtscLintRuleSetting;

  /**
   * Prefer `node:fs` / `node:path` / etc. over the bare Node builtin specifier.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-node-protocol.md
   */
  "unicorn/prefer-node-protocol"?: TtscLintRuleSetting;

  /**
   * Prefer `Number.isNaN` / `Number.parseInt` / `Number.NaN` over their global
   * counterparts.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-number-properties.md
   */
  "unicorn/prefer-number-properties"?: TtscLintRuleSetting;

  /**
   * Prefer `Object.fromEntries` over `reduce`-into-object patterns.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-object-from-entries.md
   */
  "unicorn/prefer-object-from-entries"?: TtscLintRuleSetting;

  /**
   * Prefer `catch { ... }` over `catch (e) { ... }` when `e` is unused.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-optional-catch-binding.md
   */
  "unicorn/prefer-optional-catch-binding"?: TtscLintRuleSetting;

  /**
   * Prefer borrowing prototype methods (`Array.prototype.slice.call`) over
   * `[].slice.call` empty-instance lookups.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-prototype-methods.md
   */
  "unicorn/prefer-prototype-methods"?: TtscLintRuleSetting;

  /**
   * Prefer `Document#querySelector` over `getElementById`,
   * `getElementsByClassName`, and `getElementsByTagName`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-query-selector.md
   */
  "unicorn/prefer-query-selector"?: TtscLintRuleSetting;

  /**
   * Prefer `Reflect.apply(fn, thisArg, args)` over
   * `Function.prototype.apply.call(fn, thisArg, args)`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-reflect-apply.md
   */
  "unicorn/prefer-reflect-apply"?: TtscLintRuleSetting;

  /**
   * Prefer `RegExp#test` over `String#match` / `RegExp#exec` when only a
   * boolean is needed.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-regexp-test.md
   */
  "unicorn/prefer-regexp-test"?: TtscLintRuleSetting;

  /**
   * Prefer `Response.json(value)` over `new Response( JSON.stringify(value), {
   * headers: {"content-type": "application/json"} })`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-response-static-json.md
   */
  "unicorn/prefer-response-static-json"?: TtscLintRuleSetting;

  /**
   * Prefer `Set#has` over `Array#includes` for repeated membership lookups
   * against a constant collection.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-set-has.md
   */
  "unicorn/prefer-set-has"?: TtscLintRuleSetting;

  /**
   * Prefer `Set#size` over `[...set].length` and `Array.from(set).length`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-set-size.md
   */
  "unicorn/prefer-set-size"?: TtscLintRuleSetting;

  /**
   * Prefer the simpler operand on the left of `&&` / `||` so the short-circuit
   * reads in evaluation order.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-simple-condition-first.md
   */
  "unicorn/prefer-simple-condition-first"?: TtscLintRuleSetting;

  /**
   * Prefer a single `push` / `unshift` / `classList.add` / `addEventListener`
   * with multiple arguments over consecutive single-argument calls.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-single-call.md
   */
  "unicorn/prefer-single-call"?: TtscLintRuleSetting;

  /**
   * Prefer spread (`[...arr]`, `[...str]`) over `Array.from`,
   * `Array.prototype.slice.call`, `concat([])`, and `split('')`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-spread.md
   */
  "unicorn/prefer-spread"?: TtscLintRuleSetting;

  /**
   * Prefer `String.raw` for path literals and other strings that would
   * otherwise need backslash escapes.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-string-raw.md
   */
  "unicorn/prefer-string-raw"?: TtscLintRuleSetting;

  /**
   * Prefer `String#replaceAll(literal, replacement)` over `replace(/literal/g,
   * replacement)`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-string-replace-all.md
   */
  "unicorn/prefer-string-replace-all"?: TtscLintRuleSetting;

  /**
   * Prefer `String#slice` over the deprecated `substr` / `substring`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-string-slice.md
   */
  "unicorn/prefer-string-slice"?: TtscLintRuleSetting;

  /**
   * Prefer `String#startsWith` / `String#endsWith` over equivalent
   * `RegExp#test` and slice-then-compare idioms.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-string-starts-ends-with.md
   */
  "unicorn/prefer-string-starts-ends-with"?: TtscLintRuleSetting;

  /**
   * Prefer `String#trimStart` / `String#trimEnd` over the deprecated `trimLeft`
   * / `trimRight`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-string-trim-start-end.md
   */
  "unicorn/prefer-string-trim-start-end"?: TtscLintRuleSetting;

  /**
   * Prefer `structuredClone(x)` over `JSON.parse(JSON.stringify(x))` for deep
   * cloning.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-structured-clone.md
   */
  "unicorn/prefer-structured-clone"?: TtscLintRuleSetting;

  /**
   * Prefer `switch` over chains of three or more `else if` clauses comparing
   * the same discriminant.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-switch.md
   */
  "unicorn/prefer-switch"?: TtscLintRuleSetting;

  /**
   * Prefer a ternary over `if` / `else` whose two branches differ only in the
   * right-hand side of a common assignment, `return`, or `throw`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-ternary.md
   */
  "unicorn/prefer-ternary"?: TtscLintRuleSetting;

  /**
   * Prefer top-level `await` over `.then` / IIFE wrappers in ES modules.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-top-level-await.md
   */
  "unicorn/prefer-top-level-await"?: TtscLintRuleSetting;

  /**
   * Require throwing `TypeError` (not a bare `Error`) when the surrounding `if`
   * is a runtime type check.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-type-error.md
   */
  "unicorn/prefer-type-error"?: TtscLintRuleSetting;

  /**
   * Reject common identifier abbreviations (`btn`, `arr`, `idx`) and replace
   * them with their long forms.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prevent-abbreviations.md
   */
  "unicorn/prevent-abbreviations"?: TtscLintRuleSetting;

  /**
   * Enforce a single style (always leading `./` vs. never) for relative URLs
   * passed to `new URL`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/relative-url-style.md
   */
  "unicorn/relative-url-style"?: TtscLintRuleSetting;

  /**
   * Require an explicit separator argument to `Array#join` instead of relying
   * on the default `","`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/require-array-join-separator.md
   */
  "unicorn/require-array-join-separator"?: TtscLintRuleSetting;

  /**
   * Require non-empty `with` / `assert` options on `import` / `export`
   * statements that use them at all.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/require-module-attributes.md
   */
  "unicorn/require-module-attributes"?: TtscLintRuleSetting;

  /**
   * Require a non-empty specifier list on every `import` / `export` statement.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/require-module-specifiers.md
   */
  "unicorn/require-module-specifiers"?: TtscLintRuleSetting;

  /**
   * Require an explicit digits argument to `Number#toFixed`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/require-number-to-fixed-digits-argument.md
   */
  "unicorn/require-number-to-fixed-digits-argument"?: TtscLintRuleSetting;

  /**
   * Require an explicit `targetOrigin` argument to `window.postMessage`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/require-post-message-target-origin.md
   */
  "unicorn/require-post-message-target-origin"?: TtscLintRuleSetting;

  /**
   * Enforce or replace configured string-content patterns (e.g., curly quotes
   * for straight ones).
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/string-content.md
   */
  "unicorn/string-content"?: TtscLintRuleSetting;

  /**
   * Enforce a consistent presence/absence of `{}` braces around `case` clauses
   * inside `switch`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/switch-case-braces.md
   */
  "unicorn/switch-case-braces"?: TtscLintRuleSetting;

  /**
   * Require a terminating `break`, `continue`, `return`, or `throw` to sit
   * inside a `case` clause's sole block instead of immediately after it.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/switch-case-break-position.md
   */
  "unicorn/switch-case-break-position"?: TtscLintRuleSetting;

  /**
   * Re-indent the body of tagged template literals (`html`, `gql`, `sql`) to
   * the indentation of the opening backtick.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/template-indent.md
   */
  "unicorn/template-indent"?: TtscLintRuleSetting;

  /**
   * Enforce a canonical case for text-encoding identifiers — `"utf-8"` (not
   * `"UTF-8"` / `"utf8"`).
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/text-encoding-identifier-case.md
   */
  "unicorn/text-encoding-identifier-case"?: TtscLintRuleSetting;

  /**
   * Require `throw new Error(...)` over `throw Error(...)`.
   *
   * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/throw-new-error.md
   */
  "unicorn/throw-new-error"?: TtscLintRuleSetting;
}
