import type { TtscLintRuleSetting } from "../TtscLintRuleSetting";

/**
 * Generic ESLint-compatible rules that apply to both JavaScript and
 * TypeScript source.
 *
 * Every rule listed here corresponds 1-to-1 with an ESLint core rule of the
 * same kebab-case id. TypeScript-only rules and `@typescript-eslint`
 * extension rules do **not** live here — they belong to
 * {@link ITtscLintTypeScriptRules}.
 *
 * Keeping the core family namespace-free means projects migrating from
 * ESLint can paste their rule severities into a `ttsc.lint.config.ts` file
 * without renaming anything.
 *
 * The fix availability noted in each rule's JSDoc applies when `ttsc fix`
 * or the LSP code action is invoked; a rule marked *Autofixable* may still
 * produce diagnostics that require human review for edge cases.
 *
 * @reference https://eslint.org/docs/latest/rules/
 */
export interface ITtscLintCoreRules {
  /**
   * Reject `(req, opt = 1, req2)` and similar parameter lists where a
   * required parameter follows an optional or default-valued one.
   *
   * The call site cannot omit the trailing required parameter, so the
   * optional becomes positionally required too — almost always an
   * accidental ordering.
   *
   * @reference https://eslint.org/docs/latest/rules/default-param-last
   */
  "default-param-last"?: TtscLintRuleSetting;

  /**
   * Prefer dot access (`obj.value`) over bracket access (`obj["value"]`)
   * when the string key is a valid JavaScript identifier.
   *
   * Bracket access remains accepted for reserved words, dynamic keys, or
   * keys containing characters that cannot appear in an identifier.
   *
   * @reference https://eslint.org/docs/latest/rules/dot-notation
   */
  "dot-notation"?: TtscLintRuleSetting;

  /**
   * Require strict equality operators `===` / `!==` over `==` / `!=`.
   *
   * Loose equality performs implicit type coercion that frequently hides
   * bugs.
   *
   * @reference https://eslint.org/docs/latest/rules/eqeqeq
   */
  "eqeqeq"?: TtscLintRuleSetting;

  /**
   * Reject `for` statements whose update clause moves the counter away
   * from the termination condition, such as `for (let i = 0; i < 10;
   * i--)`. Such loops either never run or never terminate.
   *
   * @reference https://eslint.org/docs/latest/rules/for-direction
   */
  "for-direction"?: TtscLintRuleSetting;

  /**
   * Reject calls to `alert`, `confirm`, and `prompt`.
   *
   * These browser dialogs block the main thread and are almost always
   * debugging leftovers or placeholders for a proper UI component.
   *
   * @reference https://eslint.org/docs/latest/rules/no-alert
   */
  "no-alert"?: TtscLintRuleSetting;

  /**
   * Reject `Array(...)` and `new Array(...)` constructor calls in favor
   * of array literals.
   *
   * `Array(n)` and `[n]` behave differently for a single numeric
   * argument, and the array literal is uniformly clearer.
   *
   * @reference https://eslint.org/docs/latest/rules/no-array-constructor
   */
  "no-array-constructor"?: TtscLintRuleSetting;

  /**
   * Reject `new Promise(async (resolve, reject) => { ... })`.
   *
   * Promises thrown asynchronously inside the executor are dropped
   * silently because the constructor has already returned the outer
   * Promise. Use a regular function and call `reject` explicitly.
   *
   * @reference https://eslint.org/docs/latest/rules/no-async-promise-executor
   */
  "no-async-promise-executor"?: TtscLintRuleSetting;

  /**
   * Reject bitwise operators (`&`, `|`, `^`, `~`, `<<`, `>>`, `>>>`).
   *
   * Bitwise operators are almost always typos for the logical operators
   * (`&&`, `||`); enable when the codebase has no legitimate
   * bit-twiddling.
   *
   * @reference https://eslint.org/docs/latest/rules/no-bitwise
   */
  "no-bitwise"?: TtscLintRuleSetting;

  /**
   * Reject `arguments.caller` and `arguments.callee`, both deprecated
   * properties forbidden in strict mode.
   *
   * They defeat engine optimizations and break under ES modules, where
   * strict mode is implicit.
   *
   * @reference https://eslint.org/docs/latest/rules/no-caller
   */
  "no-caller"?: TtscLintRuleSetting;

  /**
   * Reject lexical declarations (`let`, `const`, `class`, `function`)
   * inside `case` or `default` clauses without their own block, since
   * the declaration shares the whole `switch` scope and leaks into
   * sibling clauses.
   *
   * Wrap the case body in `{ ... }` to introduce a fresh block.
   *
   * @reference https://eslint.org/docs/latest/rules/no-case-declarations
   */
  "no-case-declarations"?: TtscLintRuleSetting;

  /**
   * Reject reassigning a class binding (`class C {}; C = ...`).
   *
   * The declaration name is effectively final; overwriting it silently
   * leaves other call sites pointing at the original class.
   *
   * @reference https://eslint.org/docs/latest/rules/no-class-assign
   */
  "no-class-assign"?: TtscLintRuleSetting;

  /**
   * Reject comparisons against `-0` (`x === -0`, `x < -0`, etc.).
   *
   * `===` treats `+0` and `-0` as equal, so the comparison never
   * distinguishes them; use `Object.is(x, -0)` when the sign of zero
   * actually matters.
   *
   * @reference https://eslint.org/docs/latest/rules/no-compare-neg-zero
   */
  "no-compare-neg-zero"?: TtscLintRuleSetting;

  /**
   * Reject assignment expressions inside conditions, such as `if (x =
   * y)` — almost always a typo for `==` / `===`.
   *
   * @reference https://eslint.org/docs/latest/rules/no-cond-assign
   */
  "no-cond-assign"?: TtscLintRuleSetting;

  /**
   * Reject calls to `console.*`.
   *
   * Typically configured as `"warning"` so leftover logging stays visible
   * without breaking the build.
   *
   * @reference https://eslint.org/docs/latest/rules/no-console
   */
  "no-console"?: TtscLintRuleSetting;

  /**
   * Reject conditions whose value can be determined statically, such
   * as `while (true)` or `if (false)`, in `if`, `while`, `do/while`,
   * `for`, and ternary expressions.
   *
   * The default `checkLoops` configuration still permits intentional
   * infinite loops in a few forms; see upstream for the matrix.
   *
   * @reference https://eslint.org/docs/latest/rules/no-constant-condition
   */
  "no-constant-condition"?: TtscLintRuleSetting;

  /**
   * Reject `continue` statements.
   *
   * Stylistic policy preferring early returns or restructured loops over
   * `continue`.
   *
   * @reference https://eslint.org/docs/latest/rules/no-continue
   */
  "no-continue"?: TtscLintRuleSetting;

  /**
   * Reject ASCII control characters (`\x00`–`\x1F`) inside regular
   * expression literals and `RegExp` strings.
   *
   * They render invisibly in source and almost always indicate an
   * accidental paste or a missed `\t` / `\n` escape.
   *
   * @reference https://eslint.org/docs/latest/rules/no-control-regex
   */
  "no-control-regex"?: TtscLintRuleSetting;

  /**
   * Reject `debugger` statements.
   *
   * Typically configured as `"error"` so accidental debugger leftovers
   * fail CI.
   *
   * @reference https://eslint.org/docs/latest/rules/no-debugger
   */
  "no-debugger"?: TtscLintRuleSetting;

  /**
   * Reject `delete` applied to plain variable bindings (`delete x`).
   *
   * The operation is forbidden in strict mode (and therefore in ES
   * modules) and never has the intended effect on `let` / `const` /
   * `var` declarations.
   *
   * @reference https://eslint.org/docs/latest/rules/no-delete-var
   */
  "no-delete-var"?: TtscLintRuleSetting;

  /**
   * Reject `function f(a, a)` and similar parameter lists that declare
   * the same name twice.
   *
   * The function cannot bind both arguments and fails in strict mode.
   *
   * @reference https://eslint.org/docs/latest/rules/no-dupe-args
   */
  "no-dupe-args"?: TtscLintRuleSetting;

  /**
   * Reject `if (a) {} else if (a) {}` — the second branch is
   * unreachable because the first condition already handled it.
   *
   * @reference https://eslint.org/docs/latest/rules/no-dupe-else-if
   */
  "no-dupe-else-if"?: TtscLintRuleSetting;

  /**
   * Reject `{ a: 1, a: 2 }` — duplicate property keys in an object
   * literal silently overwrite earlier values.
   *
   * @reference https://eslint.org/docs/latest/rules/no-dupe-keys
   */
  "no-dupe-keys"?: TtscLintRuleSetting;

  /**
   * Reject the same `case` label appearing twice in a `switch` —
   * later duplicates are unreachable.
   *
   * @reference https://eslint.org/docs/latest/rules/no-duplicate-case
   */
  "no-duplicate-case"?: TtscLintRuleSetting;

  /**
   * Reject empty blocks (`if (x) {}`, `while (x) {}`, `try {} catch
   * (e) {}` etc.) that almost always indicate forgotten code.
   *
   * @reference https://eslint.org/docs/latest/rules/no-empty
   */
  "no-empty"?: TtscLintRuleSetting;

  /**
   * Reject empty regex character classes (`[]`).
   *
   * An empty class never matches anything, so the entire pattern can
   * never succeed; the negated form `[^]` (matches any character) is
   * allowed.
   *
   * @reference https://eslint.org/docs/latest/rules/no-empty-character-class
   */
  "no-empty-character-class"?: TtscLintRuleSetting;

  /**
   * Reject empty function and method bodies (`function f() {}`, `()
   * => {}`).
   *
   * Use `() => undefined` or a leading TODO comment when the empty
   * body is intentional.
   *
   * @reference https://eslint.org/docs/latest/rules/no-empty-function
   */
  "no-empty-function"?: TtscLintRuleSetting;

  /**
   * Reject empty destructuring patterns (`const {} = obj`, `function
   * f([]) {}`), which bind nothing and are usually mid-edit typos.
   *
   * @reference https://eslint.org/docs/latest/rules/no-empty-pattern
   */
  "no-empty-pattern"?: TtscLintRuleSetting;

  /**
   * Reject empty `static {}` class initialization blocks.
   *
   * @reference https://eslint.org/docs/latest/rules/no-empty-static-block
   */
  "no-empty-static-block"?: TtscLintRuleSetting;

  /**
   * Reject loose null comparisons (`x == null`).
   *
   * Use `x === null` or the explicit `x === null || x === undefined`.
   *
   * Pairs with `eqeqeq` but kept separate so the loose null shortcut can
   * be allowed under `"smart"`-style `eqeqeq` exceptions.
   *
   * @reference https://eslint.org/docs/latest/rules/no-eq-null
   */
  "no-eq-null"?: TtscLintRuleSetting;

  /**
   * Reject `eval(...)` and indirect `eval` calls — almost always a
   * security or correctness bug.
   *
   * @reference https://eslint.org/docs/latest/rules/no-eval
   */
  "no-eval"?: TtscLintRuleSetting;

  /**
   * Reject reassigning the parameter of a `catch` clause (`catch (e) {
   * e = ... }`), which loses the original error reference.
   *
   * @reference https://eslint.org/docs/latest/rules/no-ex-assign
   */
  "no-ex-assign"?: TtscLintRuleSetting;

  /**
   * Reject unnecessary `Function.prototype.bind()` calls — for
   * example, binding without arguments or binding an arrow function
   * (which ignores `this`).
   *
   * @reference https://eslint.org/docs/latest/rules/no-extra-bind
   */
  "no-extra-bind"?: TtscLintRuleSetting;

  /**
   * Reject redundant boolean casts such as `!!Boolean(x)`, `if
   * (Boolean(x))`, or `Boolean(!!x)`.
   *
   * @reference https://eslint.org/docs/latest/rules/no-extra-boolean-cast
   */
  "no-extra-boolean-cast"?: TtscLintRuleSetting;

  /**
   * Reject `switch` case fall-through unless preceded by an explicit
   * `// falls through` comment.
   *
   * @reference https://eslint.org/docs/latest/rules/no-fallthrough
   */
  "no-fallthrough"?: TtscLintRuleSetting;

  /**
   * Reject reassignment of function declarations (`function f() {}; f
   * = 0;`).
   *
   * The hoisted binding looks final to most readers; overwriting it
   * makes the original implementation unreachable from other references.
   *
   * @reference https://eslint.org/docs/latest/rules/no-func-assign
   */
  "no-func-assign"?: TtscLintRuleSetting;

  /**
   * Reject `function` and `var` declarations nested in non-function
   * blocks (loops, `if`, etc.) — they hoist in surprising ways.
   *
   * @reference https://eslint.org/docs/latest/rules/no-inner-declarations
   */
  "no-inner-declarations"?: TtscLintRuleSetting;

  /**
   * Reject irregular whitespace characters (zero-width space,
   * non-breaking space, etc.) in source — typically copy-paste artifacts
   * from rich-text editors.
   *
   * @reference https://eslint.org/docs/latest/rules/no-irregular-whitespace
   */
  "no-irregular-whitespace"?: TtscLintRuleSetting;

  /**
   * Reject the legacy `__iterator__` property — a SpiderMonkey-only
   * extension predating ES2015 iterators.
   *
   * Use `Symbol.iterator` or a generator.
   *
   * @reference https://eslint.org/docs/latest/rules/no-iterator
   */
  "no-iterator"?: TtscLintRuleSetting;

  /**
   * Reject labeled statements (`outer: for (...) { break outer; }`).
   *
   * Labels obscure control flow; prefer extracting the inner loop into
   * a function and using `return`, or refactoring with a flag variable.
   *
   * @reference https://eslint.org/docs/latest/rules/no-labels
   */
  "no-labels"?: TtscLintRuleSetting;

  /**
   * Reject standalone `{ ... }` blocks that introduce no lexical
   * scope distinct from the surrounding block.
   *
   * Blocks that actually declare `let`, `const`, `class`, or `function`
   * (in strict mode) are exempt, since those declarations need the
   * inner scope.
   *
   * @reference https://eslint.org/docs/latest/rules/no-lone-blocks
   */
  "no-lone-blocks"?: TtscLintRuleSetting;

  /**
   * Reject `if (cond) { if (...) { ... } }` where the inner `if` is
   * the only statement in an `else` — prefer `else if`.
   *
   * @reference https://eslint.org/docs/latest/rules/no-lonely-if
   */
  "no-lonely-if"?: TtscLintRuleSetting;

  /**
   * Reject numeric literals whose source text cannot round-trip
   * through `Number` without losing digits, including overflow.
   *
   * @reference https://eslint.org/docs/latest/rules/no-loss-of-precision
   */
  "no-loss-of-precision"?: TtscLintRuleSetting;

  /**
   * Reject regex character classes that contain combined Unicode
   * sequences (e.g. surrogate pairs) which most readers will not
   * realize represent multiple code units.
   *
   * @reference https://eslint.org/docs/latest/rules/no-misleading-character-class
   */
  "no-misleading-character-class"?: TtscLintRuleSetting;

  /**
   * Reject chained assignment such as `a = b = 0`, which obscures
   * intent and surprises readers who expect comparison.
   *
   * @reference https://eslint.org/docs/latest/rules/no-multi-assign
   */
  "no-multi-assign"?: TtscLintRuleSetting;

  /**
   * Reject backslash-newline multiline string literals; use template
   * literals instead.
   *
   * @reference https://eslint.org/docs/latest/rules/no-multi-str
   */
  "no-multi-str"?: TtscLintRuleSetting;

  /**
   * Reject `if (!cond) { ... } else { ... }` — flip the branches so
   * the positive condition reads first.
   *
   * @reference https://eslint.org/docs/latest/rules/no-negated-condition
   */
  "no-negated-condition"?: TtscLintRuleSetting;

  /**
   * Reject ternary expressions nested in other ternaries
   * (`a ? b : c ? d : e`), which are hard to read at a glance.
   *
   * @reference https://eslint.org/docs/latest/rules/no-nested-ternary
   */
  "no-nested-ternary"?: TtscLintRuleSetting;

  /**
   * Reject `new` expressions whose return value is not assigned or
   * used — the object is created only for its constructor side effects.
   *
   * @reference https://eslint.org/docs/latest/rules/no-new
   */
  "no-new"?: TtscLintRuleSetting;

  /**
   * Reject `new Function(...)` and `Function(...)` calls, which
   * effectively evaluate a string and have the same risks as `eval`.
   *
   * @reference https://eslint.org/docs/latest/rules/no-new-func
   */
  "no-new-func"?: TtscLintRuleSetting;

  /**
   * Reject primitive wrapper constructors `new String(...)`, `new
   * Number(...)`, `new Boolean(...)`.
   *
   * The resulting objects compare unequal to their primitive counterparts.
   *
   * @reference https://eslint.org/docs/latest/rules/no-new-wrappers
   */
  "no-new-wrappers"?: TtscLintRuleSetting;

  /**
   * Reject calling global non-callable objects as functions, such as
   * `Math()` or `JSON()`.
   *
   * @reference https://eslint.org/docs/latest/rules/no-obj-calls
   */
  "no-obj-calls"?: TtscLintRuleSetting;

  /**
   * Reject `new Object()` and `Object()` constructor calls; use an
   * object literal `{}` instead.
   *
   * @reference https://eslint.org/docs/latest/rules/no-object-constructor
   */
  "no-object-constructor"?: TtscLintRuleSetting;

  /**
   * Reject legacy octal literals (`0123`).
   *
   * Use the `0o123` prefix when an octal literal is actually intended.
   *
   * @reference https://eslint.org/docs/latest/rules/no-octal
   */
  "no-octal"?: TtscLintRuleSetting;

  /**
   * Reject octal escape sequences in string literals (`"\251"`,
   * `"\07"`).
   *
   * Deprecated and forbidden in strict mode; use Unicode (`©`) or hex
   * (`\xA9`) escapes.
   *
   * @reference https://eslint.org/docs/latest/rules/no-octal-escape
   */
  "no-octal-escape"?: TtscLintRuleSetting;

  /**
   * Reject `++` and `--` operators.
   *
   * Prefer `+= 1` / `-= 1` to keep statements expression-only and
   * avoid ASI surprises.
   *
   * @reference https://eslint.org/docs/latest/rules/no-plusplus
   */
  "no-plusplus"?: TtscLintRuleSetting;

  /**
   * Reject `return` inside the Promise executor function — the value
   * is ignored.
   *
   * @reference https://eslint.org/docs/latest/rules/no-promise-executor-return
   */
  "no-promise-executor-return"?: TtscLintRuleSetting;

  /**
   * Reject access to `obj.__proto__`; use `Object.getPrototypeOf` /
   * `Object.setPrototypeOf`.
   *
   * @reference https://eslint.org/docs/latest/rules/no-proto
   */
  "no-proto"?: TtscLintRuleSetting;

  /**
   * Reject `obj.hasOwnProperty(key)` and other direct
   * `Object.prototype` builtins on user objects, since the property
   * may be shadowed.
   *
   * Use `Object.prototype.hasOwnProperty.call(obj, key)` or
   * `Object.hasOwn`.
   *
   * @reference https://eslint.org/docs/latest/rules/no-prototype-builtins
   */
  "no-prototype-builtins"?: TtscLintRuleSetting;

  /**
   * Reject more than one consecutive literal space in a regex; use
   * `{N}` quantifiers for clarity.
   *
   * @reference https://eslint.org/docs/latest/rules/no-regex-spaces
   */
  "no-regex-spaces"?: TtscLintRuleSetting;

  /**
   * Reject assignment expressions used as the operand of `return`
   * (`return x = 1`) — almost always a typo for `===`.
   *
   * @reference https://eslint.org/docs/latest/rules/no-return-assign
   */
  "no-return-assign"?: TtscLintRuleSetting;

  /**
   * Reject `javascript:` URLs in string literals — they execute their
   * body as code on browser navigation, and security scanners treat them
   * as an `eval` equivalent.
   *
   * @reference https://eslint.org/docs/latest/rules/no-script-url
   */
  "no-script-url"?: TtscLintRuleSetting;

  /**
   * Reject `x = x` and destructuring forms that copy a value to
   * itself — almost always a typo.
   *
   * @reference https://eslint.org/docs/latest/rules/no-self-assign
   */
  "no-self-assign"?: TtscLintRuleSetting;

  /**
   * Reject comparing a value to itself (`x === x`). Use
   * `Number.isNaN(x)` to test for `NaN`.
   *
   * @reference https://eslint.org/docs/latest/rules/no-self-compare
   */
  "no-self-compare"?: TtscLintRuleSetting;

  /**
   * Reject comma expressions (`a, b`) outside the heads of `for`
   * statements.
   *
   * @reference https://eslint.org/docs/latest/rules/no-sequences
   */
  "no-sequences"?: TtscLintRuleSetting;

  /**
   * Reject explicit `return` from a setter — setters' return values
   * are ignored.
   *
   * @reference https://eslint.org/docs/latest/rules/no-setter-return
   */
  "no-setter-return"?: TtscLintRuleSetting;

  /**
   * Reject redeclaring restricted globals (`NaN`, `Infinity`,
   * `undefined`, etc.).
   *
   * @reference https://eslint.org/docs/latest/rules/no-shadow-restricted-names
   */
  "no-shadow-restricted-names"?: TtscLintRuleSetting;

  /**
   * Reject array literals with elision (`[, 1, , 3]`), which read
   * surprisingly and rarely express intent.
   *
   * @reference https://eslint.org/docs/latest/rules/no-sparse-arrays
   */
  "no-sparse-arrays"?: TtscLintRuleSetting;

  /**
   * Reject `${expr}` inside ordinary single- or double-quoted
   * strings — almost always a missing template-literal backtick.
   *
   * @reference https://eslint.org/docs/latest/rules/no-template-curly-in-string
   */
  "no-template-curly-in-string"?: TtscLintRuleSetting;

  /**
   * Reject throwing non-Error operands (`throw "boom"`, `throw 1`).
   *
   * @reference https://eslint.org/docs/latest/rules/no-throw-literal
   */
  "no-throw-literal"?: TtscLintRuleSetting;

  /**
   * Reject initializing a variable to the literal `undefined`
   * (`let x = undefined`) — declaring without an initializer has the
   * same effect.
   *
   * @reference https://eslint.org/docs/latest/rules/no-undef-init
   */
  "no-undef-init"?: TtscLintRuleSetting;

  /**
   * Reject use of the global `undefined` identifier; use the `void 0`
   * expression or omit the value.
   *
   * @reference https://eslint.org/docs/latest/rules/no-undefined
   */
  "no-undefined"?: TtscLintRuleSetting;

  /**
   * Reject `cond ? true : false` and similar ternaries that can be
   * simplified to a boolean coercion or the condition itself.
   *
   * @reference https://eslint.org/docs/latest/rules/no-unneeded-ternary
   */
  "no-unneeded-ternary"?: TtscLintRuleSetting;

  /**
   * Reject `return` and `throw` inside a `finally` block, which
   * override any earlier `return`/`throw` from the corresponding
   * `try`/`catch`.
   *
   * @reference https://eslint.org/docs/latest/rules/no-unsafe-finally
   */
  "no-unsafe-finally"?: TtscLintRuleSetting;

  /**
   * Reject `!key in obj` and `!a instanceof B` where the `!` binds
   * tighter than the relational operator and silently coerces the
   * left operand to a boolean.
   *
   * Wrap in parens (`!(key in obj)`) when the negation is genuinely
   * intended.
   *
   * @reference https://eslint.org/docs/latest/rules/no-unsafe-negation
   */
  "no-unsafe-negation"?: TtscLintRuleSetting;

  /**
   * Reject expression statements with no observable effect, like a
   * bare `x;` or `'use strict' && f();`.
   *
   * @reference https://eslint.org/docs/latest/rules/no-unused-expressions
   */
  "no-unused-expressions"?: TtscLintRuleSetting;

  /**
   * Reject labels that no `break` or `continue` statement references.
   *
   * Usually the targeted statement was renamed or removed but the label
   * was left behind.
   *
   * @reference https://eslint.org/docs/latest/rules/no-unused-labels
   */
  "no-unused-labels"?: TtscLintRuleSetting;

  /**
   * Reject unnecessary `.call()` / `.apply()` calls (such as
   * `f.call(undefined, x)`).
   *
   * @reference https://eslint.org/docs/latest/rules/no-useless-call
   */
  "no-useless-call"?: TtscLintRuleSetting;

  /**
   * Reject `catch (e) { throw e }` patterns that only rethrow the
   * caught error without adding context or handling.
   *
   * @reference https://eslint.org/docs/latest/rules/no-useless-catch
   */
  "no-useless-catch"?: TtscLintRuleSetting;

  /**
   * Reject computed property keys whose expression is a literal
   * identifier (`{ ["foo"]: 1 }`).
   *
   * @reference https://eslint.org/docs/latest/rules/no-useless-computed-key
   */
  "no-useless-computed-key"?: TtscLintRuleSetting;

  /**
   * Reject `"a" + "b"` and similar concatenations where every operand
   * is a literal string.
   *
   * @reference https://eslint.org/docs/latest/rules/no-useless-concat
   */
  "no-useless-concat"?: TtscLintRuleSetting;

  /**
   * Reject empty constructor bodies (`class X { constructor() {} }`)
   * that add nothing over the implicit constructor.
   *
   * @reference https://eslint.org/docs/latest/rules/no-useless-constructor
   */
  "no-useless-constructor"?: TtscLintRuleSetting;

  /**
   * Reject unnecessary escape sequences in strings and regex
   * literals, such as `"\."` or `/\,/`. Autofixable.
   *
   * @reference https://eslint.org/docs/latest/rules/no-useless-escape
   */
  "no-useless-escape"?: TtscLintRuleSetting;

  /**
   * Reject `{ x: x }` destructuring renames that bind back to the
   * same name. Autofixable.
   *
   * @reference https://eslint.org/docs/latest/rules/no-useless-rename
   */
  "no-useless-rename"?: TtscLintRuleSetting;

  /**
   * Reject `var` declarations.
   *
   * Use `let` for mutable bindings and `const` for immutable ones.
   * Autofixable to `let`.
   *
   * @reference https://eslint.org/docs/latest/rules/no-var
   */
  "no-var"?: TtscLintRuleSetting;

  /**
   * Reject `with (...)` statements.
   *
   * `with` is forbidden in strict mode (and therefore in modules),
   * defeats lexical scoping, and blocks engine optimization.
   *
   * @reference https://eslint.org/docs/latest/rules/no-with
   */
  "no-with"?: TtscLintRuleSetting;

  /**
   * Reject `{ foo: foo }` and similar object-literal shorthand
   * candidates in favor of `{ foo }`. Autofixable.
   *
   * @reference https://eslint.org/docs/latest/rules/object-shorthand
   */
  "object-shorthand"?: TtscLintRuleSetting;

  /**
   * Prefer compound assignment (`x += y`) over the long form
   * (`x = x + y`) where the two are equivalent.
   *
   * @reference https://eslint.org/docs/latest/rules/operator-assignment
   */
  "operator-assignment"?: TtscLintRuleSetting;

  /**
   * Require `const` for variables that are never reassigned after
   * declaration. Autofixable for single-declaration `let`s.
   *
   * @reference https://eslint.org/docs/latest/rules/prefer-const
   */
  "prefer-const"?: TtscLintRuleSetting;

  /**
   * Prefer the `**` operator over `Math.pow(base, exp)`.
   *
   * @reference https://eslint.org/docs/latest/rules/prefer-exponentiation-operator
   */
  "prefer-exponentiation-operator"?: TtscLintRuleSetting;

  /**
   * Prefer `for..of` over a traditional `for (let i = 0; i <
   * arr.length; i++)` loop when the index is never used inside the
   * body.
   *
   * @reference https://eslint.org/docs/latest/rules/prefer-for-of
   */
  "prefer-for-of"?: TtscLintRuleSetting;

  /**
   * Prefer spread arguments `f(...args)` over `f.apply(null, args)`.
   *
   * Only flags `apply` calls whose `this` argument is provably the
   * same receiver (or `null` / `undefined`); calls that genuinely
   * rebind `this` are left alone.
   *
   * @reference https://eslint.org/docs/latest/rules/prefer-spread
   */
  "prefer-spread"?: TtscLintRuleSetting;

  /**
   * Prefer template literals over string concatenation when any
   * operand is non-literal.
   *
   * @reference https://eslint.org/docs/latest/rules/prefer-template
   */
  "prefer-template"?: TtscLintRuleSetting;

  /**
   * Require an explicit radix argument for `parseInt(str, radix)`.
   *
   * Without it, `"0123"` parses as decimal or octal depending on the
   * engine.
   *
   * @reference https://eslint.org/docs/latest/rules/radix
   */
  "radix"?: TtscLintRuleSetting;

  /**
   * Require generator functions to contain at least one `yield`. A
   * `yield`-less generator is almost always a typo.
   *
   * @reference https://eslint.org/docs/latest/rules/require-yield
   */
  "require-yield"?: TtscLintRuleSetting;

  /**
   * Require `Number.isNaN` / `isNaN` for `NaN` checks; restrict
   * `typeof` comparisons to the documented strings.
   *
   * @reference https://eslint.org/docs/latest/rules/use-isnan
   */
  "use-isnan"?: TtscLintRuleSetting;

  /**
   * Restrict the right-hand operand of `typeof` to the documented
   * strings (`"number"`, `"object"`, ...) so `typeof x === "undefiend"`
   * typos are caught.
   *
   * @reference https://eslint.org/docs/latest/rules/valid-typeof
   */
  "valid-typeof"?: TtscLintRuleSetting;

  /**
   * Require `var` declarations to be hoisted to the top of their
   * scope by hand, mirroring how the engine treats them.
   *
   * Has no effect when `no-var` forbids `var` altogether.
   *
   * @reference https://eslint.org/docs/latest/rules/vars-on-top
   */
  "vars-on-top"?: TtscLintRuleSetting;

  /**
   * Reject Yoda-style comparisons (`if (42 === x)`); use
   * `if (x === 42)` so the variable comes first.
   *
   * @reference https://eslint.org/docs/latest/rules/yoda
   */
  "yoda"?: TtscLintRuleSetting;
}
