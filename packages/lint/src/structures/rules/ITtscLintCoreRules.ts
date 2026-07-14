import type {
  TtscLintRuleOptionsSetting,
  TtscLintRuleSetting,
} from "../TtscLintRuleSetting";
import type {
  ITtscLintCoreNoDuplicateImportsRuleOptions,
  ITtscLintCoreNoEmptyFunctionRuleOptions,
  ITtscLintCoreNoEmptyRuleOptions,
  ITtscLintCoreNoParamReassignRuleOptions,
  ITtscLintCoreNoPromiseExecutorReturnRuleOptions,
  ITtscLintCoreNoUnusedExpressionsRuleOptions,
  ITtscLintCorePreferConstRuleOptions,
  ITtscLintNoFallthroughRuleOptions,
  TtscLintCoreNoInnerDeclarationsRuleSetting,
  TtscLintCoreNoRestrictedImportsRuleSetting,
} from "./ITtscLintCoreRuleOptions";

/**
 * Generic ESLint-compatible rules that apply to both JavaScript and TypeScript
 * source.
 *
 * Every rule listed here corresponds 1-to-1 with an ESLint core rule of the
 * same kebab-case id. TypeScript-only rules and `@typescript-eslint` extension
 * rules do **not** live here — they belong to {@link ITtscLintTypeScriptRules}.
 *
 * Keeping the core family namespace-free means projects migrating from ESLint
 * can paste their rule severities into a `ttsc.lint.config.ts` file without
 * renaming anything.
 *
 * The fix availability noted in each rule's JSDoc applies when `ttsc fix` or
 * the LSP code action is invoked; a rule marked _Autofixable_ may still produce
 * diagnostics that require human review for edge cases.
 *
 * @reference https://eslint.org/docs/latest/rules/
 */
export interface ITtscLintCoreRules {
  /**
   * Require block statements for every `if`, `else`, `while`, `for`, and `do`
   * body — reject the single-statement shorthand.
   *
   * @reference https://eslint.org/docs/latest/rules/curly
   */
  curly?: TtscLintRuleSetting;

  /**
   * Require `switch` statements to include a `default` clause.
   *
   * A switch without `default` silently drops every discriminant value that no
   * `case` label matched. The rule forces the catch-all branch to be written
   * out so unhandled cases become an intentional decision instead of a hidden
   * fall-through.
   *
   * @reference https://eslint.org/docs/latest/rules/default-case
   */
  "default-case"?: TtscLintRuleSetting;

  /**
   * Require the `default` clause of a `switch` statement to appear after every
   * explicit `case` label.
   *
   * Placing `default` ahead of a `case` reverses the visual order of the labels
   * and changes the fall-through path — running `default` and then falling into
   * the next `case` is almost always a misordering rather than intent.
   *
   * @reference https://eslint.org/docs/latest/rules/default-case-last
   */
  "default-case-last"?: TtscLintRuleSetting;

  /**
   * Reject identifier declarations that aren't camelCase or PascalCase —
   * snake_case bindings are flagged.
   *
   * @reference https://eslint.org/docs/latest/rules/camelcase
   */
  camelcase?: TtscLintRuleSetting;

  /**
   * Reject function bodies whose cyclomatic complexity exceeds twenty (default
   * ESLint threshold).
   *
   * @reference https://eslint.org/docs/latest/rules/complexity
   */
  complexity?: TtscLintRuleSetting;

  /**
   * Reject functions where some `return` statements return a value and others
   * (explicit bare `return;` or implicit fall-through) do not.
   *
   * @reference https://eslint.org/docs/latest/rules/consistent-return
   */
  "consistent-return"?: TtscLintRuleSetting;

  /**
   * Reject `(req, opt = 1, req2)` and similar parameter lists where a required
   * parameter follows an optional or default-valued one.
   *
   * The call site cannot omit the trailing required parameter, so the optional
   * becomes positionally required too — almost always an accidental ordering.
   *
   * @reference https://eslint.org/docs/latest/rules/default-param-last
   */
  "default-param-last"?: TtscLintRuleSetting;

  /**
   * Prefer dot access (`obj.value`) over bracket access (`obj["value"]`) when
   * the string key is a valid JavaScript identifier.
   *
   * Bracket access remains accepted for reserved words, dynamic keys, or keys
   * containing characters that cannot appear in an identifier.
   *
   * @reference https://eslint.org/docs/latest/rules/dot-notation
   */
  "dot-notation"?: TtscLintRuleSetting;

  /**
   * Require strict equality operators `===` / `!==` over `==` / `!=`.
   *
   * Loose equality performs implicit type coercion that frequently hides bugs.
   *
   * @reference https://eslint.org/docs/latest/rules/eqeqeq
   */
  eqeqeq?: TtscLintRuleSetting;

  /**
   * Reject `for` statements whose update clause moves the counter away from the
   * termination condition, such as `for (let i = 0; i < 10; i--)`. Such loops
   * either never run or never terminate.
   *
   * @reference https://eslint.org/docs/latest/rules/for-direction
   */
  "for-direction"?: TtscLintRuleSetting;

  /**
   * Require a `get` accessor's body to return a value on every reachable exit.
   * A getter that falls through returns `undefined` to the caller, which is
   * almost never the intent and turns into a silent bug that only surfaces when
   * the property is finally read.
   *
   * @reference https://eslint.org/docs/latest/rules/getter-return
   */
  "getter-return"?: TtscLintRuleSetting;

  /**
   * Require the `get` and `set` accessors of a single property to be declared
   * adjacent in the class body.
   *
   * When the read and write halves of a property are split apart by unrelated
   * members, a reader scanning the class has to chase the pair across the body
   * — and patches to one half are easy to make without noticing the other.
   *
   * @reference https://eslint.org/docs/latest/rules/grouped-accessor-pairs
   */
  "grouped-accessor-pairs"?: TtscLintRuleSetting;

  /**
   * Require the body of every `for (key in obj)` loop to begin with a guard
   * against inherited keys: `Object.hasOwn(obj, key)` or the older
   * `Object.prototype.hasOwnProperty.call(obj, key)`. The inverted-guard
   * early-skip shape `if (!Object.hasOwn(...)) continue;` is also accepted.
   *
   * Without the guard the loop processes every enumerable name on the prototype
   * chain — including monkey-patches someone else attached to
   * `Object.prototype` — so an unguarded body silently leaks work onto
   * inherited entries.
   *
   * @reference https://eslint.org/docs/latest/rules/guard-for-in
   */
  "guard-for-in"?: TtscLintRuleSetting;

  /**
   * Reject identifier names shorter than two characters.
   *
   * @reference https://eslint.org/docs/latest/rules/id-length
   */
  "id-length"?: TtscLintRuleSetting;

  /**
   * Require every `var` / `let` declaration to be initialized at its
   * declaration site.
   *
   * @reference https://eslint.org/docs/latest/rules/init-declarations
   */
  "init-declarations"?: TtscLintRuleSetting;

  /**
   * Reject a source file that declares more than one class.
   *
   * @reference https://eslint.org/docs/latest/rules/max-classes-per-file
   */
  "max-classes-per-file"?: TtscLintRuleSetting;

  /**
   * Reject block-statement nesting deeper than four levels inside a function.
   *
   * @reference https://eslint.org/docs/latest/rules/max-depth
   */
  "max-depth"?: TtscLintRuleSetting;

  /**
   * Reject a source file whose total line count exceeds three hundred.
   *
   * @reference https://eslint.org/docs/latest/rules/max-lines
   */
  "max-lines"?: TtscLintRuleSetting;

  /**
   * Reject a function whose body spans more than fifty lines.
   *
   * @reference https://eslint.org/docs/latest/rules/max-lines-per-function
   */
  "max-lines-per-function"?: TtscLintRuleSetting;

  /**
   * Reject callback nesting deeper than ten inside a single function.
   *
   * @reference https://eslint.org/docs/latest/rules/max-nested-callbacks
   */
  "max-nested-callbacks"?: TtscLintRuleSetting;

  /**
   * Reject function declarations whose parameter list grows beyond three. Long
   * parameter lists are hard to read at the call site because positional
   * arguments lose their names; folding them into an options object recovers
   * the names and lets callers pass a subset.
   *
   * Every function-like declaration is checked: function declarations, function
   * expressions, arrow functions, methods, accessors, and constructors. The
   * threshold is fixed at three to match the ESLint default; rule options are
   * deferred.
   *
   * @reference https://eslint.org/docs/latest/rules/max-params
   */
  "max-params"?: TtscLintRuleSetting;

  /**
   * Reject function bodies whose statement count exceeds ten.
   *
   * @reference https://eslint.org/docs/latest/rules/max-statements
   */
  "max-statements"?: TtscLintRuleSetting;

  /**
   * Reject calls to `alert`, `confirm`, and `prompt`.
   *
   * These browser dialogs block the main thread and are almost always debugging
   * leftovers or placeholders for a proper UI component.
   *
   * @reference https://eslint.org/docs/latest/rules/no-alert
   */
  "no-alert"?: TtscLintRuleSetting;

  /**
   * Reject `Array(...)` and `new Array(...)` constructor calls in favor of
   * array literals.
   *
   * `Array(n)` and `[n]` behave differently for a single numeric argument, and
   * the array literal is uniformly clearer.
   *
   * @reference https://eslint.org/docs/latest/rules/no-array-constructor
   */
  "no-array-constructor"?: TtscLintRuleSetting;

  /**
   * Reject `new Promise(async (resolve, reject) => { ... })`.
   *
   * Promises thrown asynchronously inside the executor are dropped silently
   * because the constructor has already returned the outer Promise. Use a
   * regular function and call `reject` explicitly.
   *
   * @reference https://eslint.org/docs/latest/rules/no-async-promise-executor
   */
  "no-async-promise-executor"?: TtscLintRuleSetting;

  /**
   * Reject `await` expressions evaluated inside a loop body. The loop runs
   * strictly serially because each iteration blocks on the previous one's
   * microtask hop; when the operations are independent the equivalent
   * `Promise.all([…])` is dramatically faster. The rule intentionally exempts
   * `for await … of` because the awaitable iterator is the loop's whole reason
   * for existing.
   *
   * @reference https://eslint.org/docs/latest/rules/no-await-in-loop
   */
  "no-await-in-loop"?: TtscLintRuleSetting;

  /**
   * Reject bitwise operators (`&`, `|`, `^`, `~`, `<<`, `>>`, `>>>`).
   *
   * Bitwise operators are almost always typos for the logical operators (`&&`,
   * `||`); enable when the codebase has no legitimate bit-twiddling.
   *
   * @reference https://eslint.org/docs/latest/rules/no-bitwise
   */
  "no-bitwise"?: TtscLintRuleSetting;

  /**
   * Reject `arguments.caller` and `arguments.callee`, both deprecated
   * properties forbidden in strict mode.
   *
   * They defeat engine optimizations and break under ES modules, where strict
   * mode is implicit.
   *
   * @reference https://eslint.org/docs/latest/rules/no-caller
   */
  "no-caller"?: TtscLintRuleSetting;

  /**
   * Reject lexical declarations (`let`, `const`, `class`, `function`) inside
   * `case` or `default` clauses without their own block, since the declaration
   * shares the whole `switch` scope and leaks into sibling clauses.
   *
   * Wrap the case body in `{ ... }` to introduce a fresh block.
   *
   * @reference https://eslint.org/docs/latest/rules/no-case-declarations
   */
  "no-case-declarations"?: TtscLintRuleSetting;

  /**
   * Reject every write to a binding introduced by a class declaration or
   * named class expression.
   *
   * Binding identity is resolved lexically, so same-spelled parameter, catch,
   * block, and sibling bindings remain independent. Direct and compound
   * assignments, updates, destructuring targets, and `for-in`/`for-of` targets
   * are all covered.
   *
   * @reference https://eslint.org/docs/latest/rules/no-class-assign
   */
  "no-class-assign"?: TtscLintRuleSetting;

  /**
   * Reject comparisons against `-0` (`x === -0`, `x < -0`, etc.).
   *
   * `===` treats `+0` and `-0` as equal, so the comparison never distinguishes
   * them; use `Object.is(x, -0)` when the sign of zero actually matters.
   *
   * @reference https://eslint.org/docs/latest/rules/no-compare-neg-zero
   */
  "no-compare-neg-zero"?: TtscLintRuleSetting;

  /**
   * Reject assignment expressions inside conditions, such as `if (x = y)` —
   * almost always a typo for `==` / `===`.
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
   * Reject conditions whose value can be determined statically, such as `while
   * (true)` or `if (false)`, in `if`, `while`, `do/while`, `for`, and ternary
   * expressions.
   *
   * The default `checkLoops` configuration still permits intentional infinite
   * loops in a few forms; see upstream for the matrix.
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
   * Reject `return X;` (with a value) inside a class constructor. The returned
   * value is ignored when the constructor is invoked with `new` unless it
   * happens to be an object; relying on that behavior is always a
   * misunderstanding of the constructor protocol.
   *
   * @reference https://eslint.org/docs/latest/rules/no-constructor-return
   */
  "no-constructor-return"?: TtscLintRuleSetting;

  /**
   * Reject ASCII control characters (`\x00`–`\x1F`) inside regular expression
   * literals and `RegExp` strings.
   *
   * They render invisibly in source and almost always indicate an accidental
   * paste or a missed `\t` / `\n` escape.
   *
   * @reference https://eslint.org/docs/latest/rules/no-control-regex
   */
  "no-control-regex"?: TtscLintRuleSetting;

  /**
   * Reject `debugger` statements.
   *
   * Typically configured as `"error"` so accidental debugger leftovers fail CI.
   *
   * @reference https://eslint.org/docs/latest/rules/no-debugger
   */
  "no-debugger"?: TtscLintRuleSetting;

  /**
   * Reject `delete` applied to plain variable bindings (`delete x`).
   *
   * The operation is forbidden in strict mode (and therefore in ES modules) and
   * never has the intended effect on `let` / `const` / `var` declarations.
   *
   * @reference https://eslint.org/docs/latest/rules/no-delete-var
   */
  "no-delete-var"?: TtscLintRuleSetting;

  /**
   * Reject `function f(a, a)` and similar parameter lists that declare the same
   * name twice.
   *
   * The function cannot bind both arguments and fails in strict mode.
   *
   * @reference https://eslint.org/docs/latest/rules/no-dupe-args
   */
  "no-dupe-args"?: TtscLintRuleSetting;

  /**
   * Reject two declarations of the same member on a single class. The later
   * declaration silently overwrites the earlier one at runtime; the syntax
   * permits it but the result is never what the author intended. A getter and a
   * setter for the same property coexist; an instance member and a static
   * member with the same name coexist.
   *
   * @reference https://eslint.org/docs/latest/rules/no-dupe-class-members
   */
  "no-dupe-class-members"?: TtscLintRuleSetting;

  /**
   * Reject an `else if` branch when duplicate or structurally covered
   * conditions earlier in the same chain make it unreachable.
   *
   * @reference https://eslint.org/docs/latest/rules/no-dupe-else-if
   */
  "no-dupe-else-if"?: TtscLintRuleSetting;

  /**
   * Reject `{ a: 1, a: 2 }` — duplicate property keys in an object literal
   * silently overwrite earlier values.
   *
   * @reference https://eslint.org/docs/latest/rules/no-dupe-keys
   */
  "no-dupe-keys"?: TtscLintRuleSetting;

  /**
   * Reject the same `case` label appearing twice in a `switch` — later
   * duplicates are unreachable.
   *
   * @reference https://eslint.org/docs/latest/rules/no-duplicate-case
   */
  "no-duplicate-case"?: TtscLintRuleSetting;

  /**
   * Reject an import declaration whose module specifier already appeared above
   * when the two declarations could be merged into one legal declaration.
   * Same-module pairs TypeScript cannot consolidate — named next to namespace
   * bindings, or a type-only default next to type-only named bindings — are not
   * duplicates. `allowSeparateTypeImports` additionally keeps clause-level
   * `import type` declarations apart from value imports, and `includeExports`
   * folds `export … from` declarations into the same analysis.
   *
   * @reference https://eslint.org/docs/latest/rules/no-duplicate-imports
   */
  "no-duplicate-imports"?: TtscLintRuleOptionsSetting<ITtscLintCoreNoDuplicateImportsRuleOptions>;

  /**
   * Reject an `else` block whose preceding `if` branch already terminates
   * control flow with `return`, `throw`, `break`, or `continue` — flatten the
   * body into the surrounding scope.
   *
   * @reference https://eslint.org/docs/latest/rules/no-else-return
   */
  "no-else-return"?: TtscLintRuleSetting;

  /**
   * Reject empty, uncommented blocks and switches. Set `allowEmptyCatch` to
   * accept an uncommented empty catch clause; its default is `false`.
   *
   * @reference https://eslint.org/docs/latest/rules/no-empty
   */
  "no-empty"?: TtscLintRuleOptionsSetting<ITtscLintCoreNoEmptyRuleOptions>;

  /**
   * Reject empty regex character classes (`[]`).
   *
   * An empty class never matches anything, so the entire pattern can never
   * succeed; the negated form `[^]` (matches any character) is allowed.
   *
   * @reference https://eslint.org/docs/latest/rules/no-empty-character-class
   */
  "no-empty-character-class"?: TtscLintRuleSetting;

  /**
   * Reject empty, uncommented function bodies. The `allow` option accepts
   * canonical function, method, accessor, constructor, async, generator,
   * decorator, and override categories.
   *
   * @reference https://eslint.org/docs/latest/rules/no-empty-function
   */
  "no-empty-function"?: TtscLintRuleOptionsSetting<ITtscLintCoreNoEmptyFunctionRuleOptions>;

  /**
   * Reject empty named import or export clauses — `import {} from "x"`, `import
   * name, {} from "x"`, and `export {}` — which bind nothing.
   *
   * The empty-only import shape leaves just the side-effect load and is better
   * written as `import "x"`; the default-plus-empty form should drop the empty
   * clause; and a bare `export {}` either restates module-ness redundantly or
   * marks an otherwise non-module file in a way that has cleaner alternatives.
   * The stricter sibling rule `typescript/no-useless-empty-export` fires only
   * when another module-syntax statement is already present.
   *
   * @reference https://eslint.org/docs/latest/rules/no-empty-named-blocks
   */
  "no-empty-named-blocks"?: TtscLintRuleSetting;

  /**
   * Reject empty destructuring patterns (`const {} = obj`, `function f([])
   * {}`), which bind nothing and are usually mid-edit typos.
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
   * Pairs with `eqeqeq` but kept separate so the loose null shortcut can be
   * allowed under `"smart"`-style `eqeqeq` exceptions.
   *
   * @reference https://eslint.org/docs/latest/rules/no-eq-null
   */
  "no-eq-null"?: TtscLintRuleSetting;

  /**
   * Reject `eval(...)` and indirect `eval` calls — almost always a security or
   * correctness bug.
   *
   * @reference https://eslint.org/docs/latest/rules/no-eval
   */
  "no-eval"?: TtscLintRuleSetting;

  /**
   * Reject reassigning the parameter of a `catch` clause (`catch (e) { e = ...
   * }`), which loses the original error reference.
   *
   * @reference https://eslint.org/docs/latest/rules/no-ex-assign
   */
  "no-ex-assign"?: TtscLintRuleSetting;

  /**
   * Reject assignments to a built-in prototype such as `Array.prototype.foo =
   * bar`. Only `<Builtin>.prototype.<key> = …` is flagged; assigning to
   * `Object.foo = …` (a static property) is left alone.
   *
   * @reference https://eslint.org/docs/latest/rules/no-extend-native
   */
  "no-extend-native"?: TtscLintRuleSetting;

  /**
   * Reject `.bind(thisArg)` on an arrow function or on a regular function whose
   * own scope never reads `this`. Calls that bind later arguments are preserved
   * as partial applications.
   *
   * @reference https://eslint.org/docs/latest/rules/no-extra-bind
   */
  "no-extra-bind"?: TtscLintRuleSetting;

  /**
   * Reject redundant boolean casts such as `!!Boolean(x)`, `if (Boolean(x))`,
   * or `Boolean(!!x)`.
   *
   * @reference https://eslint.org/docs/latest/rules/no-extra-boolean-cast
   */
  "no-extra-boolean-cast"?: TtscLintRuleSetting;

  /**
   * Reject `switch` cases that can reach the next `case` / `default` label
   * without an intentional-fallthrough comment (`// falls through` by
   * default).
   *
   * Reachability follows statement completion: a case whose every path ends in
   * `break`, `continue`, `return`, or `throw` (composed through blocks,
   * `if/else`, loops, labeled statements, and `try/catch/finally`) does not
   * fall through, while a `return` inside a nested function never terminates
   * the case. Options: {@link ITtscLintNoFallthroughRuleOptions}.
   *
   * @reference https://eslint.org/docs/latest/rules/no-fallthrough
   */
  "no-fallthrough"?: TtscLintRuleOptionsSetting<ITtscLintNoFallthroughRuleOptions>;

  /**
   * Reject writes to bindings introduced by function declarations and named
   * function expressions. Lexical binding identity keeps same-spelled shadows
   * independent across parameters, blocks, catches, and sibling scopes.
   *
   * Direct and compound assignment, updates, destructuring, and for-in/of
   * targets are all modifying references to the function binding.
   *
   * @reference https://eslint.org/docs/latest/rules/no-func-assign
   */
  "no-func-assign"?: TtscLintRuleSetting;

  /**
   * Reject common implicit-coercion idioms (`!!x`, `+x`, `"" + x`) in favor of
   * the explicit `Boolean(x)` / `Number(x)` / `String(x)` conversions. The
   * explicit forms are more readable and avoid surprise around primitive edge
   * cases.
   *
   * @reference https://eslint.org/docs/latest/rules/no-implicit-coercion
   */
  "no-implicit-coercion"?: TtscLintRuleSetting;

  /**
   * Reject writes to a binding introduced by an `import` declaration —
   * assignment (`x = …`), compound assignment, or increment/decrement of an
   * imported name, plus property mutations of a namespace import (`ns.foo =
   * …`). Imported bindings are read-only at runtime; mutating them either
   * throws under strict mode or silently desynchronises the module's view of
   * its own exports.
   *
   * @reference https://eslint.org/docs/latest/rules/no-import-assign
   */
  "no-import-assign"?: TtscLintRuleSetting;

  /**
   * Reject function declarations nested in sloppy blocks. The `"both"` mode
   * also checks `var`; strict ES2015 block-scoped functions are allowed by
   * default and can be disabled through `blockScopedFunctions`.
   *
   * @reference https://eslint.org/docs/latest/rules/no-inner-declarations
   */
  "no-inner-declarations"?: TtscLintCoreNoInnerDeclarationsRuleSetting;

  /**
   * Reject `this` references outside any function-like, class method, or
   * class-static-block context.
   *
   * @reference https://eslint.org/docs/latest/rules/no-invalid-this
   */
  "no-invalid-this"?: TtscLintRuleSetting;

  /**
   * Reject irregular whitespace characters (zero-width space, non-breaking
   * space, etc.) in source — typically copy-paste artifacts from rich-text
   * editors.
   *
   * @reference https://eslint.org/docs/latest/rules/no-irregular-whitespace
   */
  "no-irregular-whitespace"?: TtscLintRuleSetting;

  /**
   * Reject the legacy `__iterator__` property — a SpiderMonkey-only extension
   * predating ES2015 iterators.
   *
   * Use `Symbol.iterator` or a generator.
   *
   * @reference https://eslint.org/docs/latest/rules/no-iterator
   */
  "no-iterator"?: TtscLintRuleSetting;

  /**
   * Reject labeled statements (`outer: for (...) { break outer; }`).
   *
   * Labels obscure control flow; prefer extracting the inner loop into a
   * function and using `return`, or refactoring with a flag variable.
   *
   * @reference https://eslint.org/docs/latest/rules/no-labels
   */
  "no-labels"?: TtscLintRuleSetting;

  /**
   * Reject standalone `{ ... }` blocks that introduce no lexical scope distinct
   * from the surrounding block.
   *
   * Blocks that actually declare `let`, `const`, `class`, or `function` (in
   * strict mode) are exempt, since those declarations need the inner scope.
   *
   * @reference https://eslint.org/docs/latest/rules/no-lone-blocks
   */
  "no-lone-blocks"?: TtscLintRuleSetting;

  /**
   * Reject `if (cond) { if (...) { ... } }` where the inner `if` is the only
   * statement in an `else` — prefer `else if`.
   *
   * @reference https://eslint.org/docs/latest/rules/no-lonely-if
   */
  "no-lonely-if"?: TtscLintRuleSetting;

  /**
   * Reject function declarations defined inside the body of a loop. Each
   * iteration of the loop allocates a fresh function whose closure captures the
   * surrounding `let`/`var` binding — a class of bugs where every captured
   * function reads the iteration's final value instead of its own.
   *
   * @reference https://eslint.org/docs/latest/rules/no-loop-func
   */
  "no-loop-func"?: TtscLintRuleSetting;

  /**
   * Reject numeric literals whose source text cannot round-trip through
   * `Number` without losing digits, including overflow.
   *
   * @reference https://eslint.org/docs/latest/rules/no-loss-of-precision
   */
  "no-loss-of-precision"?: TtscLintRuleSetting;

  /**
   * Reject inline numeric literals outside `const` initializer position. `0`,
   * `1`, `-1`, array indices, and enum values are exempt.
   *
   * @reference https://eslint.org/docs/latest/rules/no-magic-numbers
   */
  "no-magic-numbers"?: TtscLintRuleSetting;

  /**
   * Reject regex character classes that contain combined Unicode sequences
   * (e.g. surrogate pairs) which most readers will not realize represent
   * multiple code units.
   *
   * @reference https://eslint.org/docs/latest/rules/no-misleading-character-class
   */
  "no-misleading-character-class"?: TtscLintRuleSetting;

  /**
   * Reject mixing operators of different precedence families in the same
   * expression without explicit parentheses around the inner sub-expression.
   * The famous case is `a && b || c`: readers expect left-to-right grouping but
   * the parser sees `(a && b) || c` because `&&` binds tighter than `||`.
   *
   * The conservative baseline only flags the highest-confusion mixes — logical
   * mixed with a different logical (`&&` next to `||` / `??`), and bitwise
   * (`&`, `|`, `^`) next to a comparison or logical. Wrapping the inner
   * sub-expression in parens suppresses the report.
   *
   * @reference https://eslint.org/docs/latest/rules/no-mixed-operators
   */
  "no-mixed-operators"?: TtscLintRuleSetting;

  /**
   * Reject chained assignment such as `a = b = 0`, which obscures intent and
   * surprises readers who expect comparison.
   *
   * @reference https://eslint.org/docs/latest/rules/no-multi-assign
   */
  "no-multi-assign"?: TtscLintRuleSetting;

  /**
   * Reject backslash-newline multiline string literals; use template literals
   * instead.
   *
   * @reference https://eslint.org/docs/latest/rules/no-multi-str
   */
  "no-multi-str"?: TtscLintRuleSetting;

  /**
   * Reject `if (!cond) { ... } else { ... }` — flip the branches so the
   * positive condition reads first.
   *
   * @reference https://eslint.org/docs/latest/rules/no-negated-condition
   */
  "no-negated-condition"?: TtscLintRuleSetting;

  /**
   * Reject ternary expressions nested in other ternaries (`a ? b : c ? d : e`),
   * which are hard to read at a glance.
   *
   * @reference https://eslint.org/docs/latest/rules/no-nested-ternary
   */
  "no-nested-ternary"?: TtscLintRuleSetting;

  /**
   * Reject `new` expressions whose return value is not assigned or used — the
   * object is created only for its constructor side effects.
   *
   * @reference https://eslint.org/docs/latest/rules/no-new
   */
  "no-new"?: TtscLintRuleSetting;

  /**
   * Reject `new Function(...)` and `Function(...)` calls, which effectively
   * evaluate a string and have the same risks as `eval`.
   *
   * @reference https://eslint.org/docs/latest/rules/no-new-func
   */
  "no-new-func"?: TtscLintRuleSetting;

  /**
   * Reject primitive wrapper constructors `new String(...)`, `new Number(...)`,
   * `new Boolean(...)`.
   *
   * The resulting objects compare unequal to their primitive counterparts.
   *
   * @reference https://eslint.org/docs/latest/rules/no-new-wrappers
   */
  "no-new-wrappers"?: TtscLintRuleSetting;

  /**
   * Reject `new Symbol(...)`. `Symbol` is a function but not a constructor;
   * calling it with `new` throws a TypeError at runtime. The upstream rule was
   * renamed `no-new-native-nonconstructor`; the legacy name remains the more
   * readable pointer for this specific Symbol check.
   *
   * @reference https://eslint.org/docs/latest/rules/no-new-symbol
   */
  "no-new-symbol"?: TtscLintRuleSetting;

  /**
   * Reject calling global non-callable objects as functions, such as `Math()`
   * or `JSON()`.
   *
   * @reference https://eslint.org/docs/latest/rules/no-obj-calls
   */
  "no-obj-calls"?: TtscLintRuleSetting;

  /**
   * Reject `new Object()` and `Object()` constructor calls; use an object
   * literal `{}` instead.
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
   * Reject octal escape sequences in string literals (`"\251"`, `"\07"`).
   *
   * Deprecated and forbidden in strict mode; use Unicode (`©`) or hex (`\xA9`)
   * escapes.
   *
   * @reference https://eslint.org/docs/latest/rules/no-octal-escape
   */
  "no-octal-escape"?: TtscLintRuleSetting;

  /**
   * Reject writes to a function parameter's binding, including through nested
   * closures and destructuring assignment targets. `props: true` also reports
   * property writes, with the official exact-name and regular-expression
   * ignore lists.
   *
   * @reference https://eslint.org/docs/latest/rules/no-param-reassign
   */
  "no-param-reassign"?: TtscLintRuleOptionsSetting<ITtscLintCoreNoParamReassignRuleOptions>;

  /**
   * Reject `++` and `--` operators.
   *
   * Prefer `+= 1` / `-= 1` to keep statements expression-only and avoid ASI
   * surprises.
   *
   * @reference https://eslint.org/docs/latest/rules/no-plusplus
   */
  "no-plusplus"?: TtscLintRuleSetting;

  /**
   * Reject values returned by the global Promise constructor's executor. This
   * covers concise arrows and explicit returns without crossing nested
   * function boundaries. Set `allowVoid` to accept an explicit unary `void`
   * return.
   *
   * @reference https://eslint.org/docs/latest/rules/no-promise-executor-return
   */
  "no-promise-executor-return"?: TtscLintRuleOptionsSetting<ITtscLintCoreNoPromiseExecutorReturnRuleOptions>;

  /**
   * Reject access to `obj.__proto__`; use `Object.getPrototypeOf` /
   * `Object.setPrototypeOf`.
   *
   * @reference https://eslint.org/docs/latest/rules/no-proto
   */
  "no-proto"?: TtscLintRuleSetting;

  /**
   * Reject `obj.hasOwnProperty(key)` and other direct `Object.prototype`
   * builtins on user objects, since the property may be shadowed.
   *
   * Use `Object.prototype.hasOwnProperty.call(obj, key)` or `Object.hasOwn`.
   *
   * @reference https://eslint.org/docs/latest/rules/no-prototype-builtins
   */
  "no-prototype-builtins"?: TtscLintRuleSetting;

  /**
   * Reject declaring the same binding more than once in the same scope (`var x
   * = 1; var x = 2;`, two `function foo()` declarations side by side, or a
   * parameter rebound by a later `var` in the body). The second declaration
   * silently overwrites the first; shadowing the binding in a nested scope is
   * left alone.
   *
   * @reference https://eslint.org/docs/latest/rules/no-redeclare
   */
  "no-redeclare"?: TtscLintRuleSetting;

  /**
   * Reject more than one consecutive literal space in a regex; use `{N}`
   * quantifiers for clarity.
   *
   * @reference https://eslint.org/docs/latest/rules/no-regex-spaces
   */
  "no-regex-spaces"?: TtscLintRuleSetting;

  /**
   * Reject static imports and re-exports selected by exact paths or patterns.
   * Missing or empty restrictions are a no-op.
   *
   * @reference https://eslint.org/docs/latest/rules/no-restricted-imports
   */
  "no-restricted-imports"?: TtscLintCoreNoRestrictedImportsRuleSetting;

  /**
   * Reject AST node kinds listed in the project denylist.
   *
   * @reference https://eslint.org/docs/latest/rules/no-restricted-syntax
   */
  "no-restricted-syntax"?: TtscLintRuleSetting;

  /**
   * Reject assignment expressions used as the operand of `return` (`return x =
   * 1`) — almost always a typo for `===`.
   *
   * @reference https://eslint.org/docs/latest/rules/no-return-assign
   */
  "no-return-assign"?: TtscLintRuleSetting;

  /**
   * Reject `javascript:` URLs in string literals — they execute their body as
   * code on browser navigation, and security scanners treat them as an `eval`
   * equivalent.
   *
   * @reference https://eslint.org/docs/latest/rules/no-script-url
   */
  "no-script-url"?: TtscLintRuleSetting;

  /**
   * Reject `x = x` and destructuring forms that copy a value to itself — almost
   * always a typo.
   *
   * @reference https://eslint.org/docs/latest/rules/no-self-assign
   */
  "no-self-assign"?: TtscLintRuleSetting;

  /**
   * Reject comparing a value to itself (`x === x`). Use `Number.isNaN(x)` to
   * test for `NaN`.
   *
   * @reference https://eslint.org/docs/latest/rules/no-self-compare
   */
  "no-self-compare"?: TtscLintRuleSetting;

  /**
   * Reject comma expressions (`a, b`) outside the heads of `for` statements.
   *
   * @reference https://eslint.org/docs/latest/rules/no-sequences
   */
  "no-sequences"?: TtscLintRuleSetting;

  /**
   * Reject explicit `return` from a setter — setters' return values are
   * ignored.
   *
   * @reference https://eslint.org/docs/latest/rules/no-setter-return
   */
  "no-setter-return"?: TtscLintRuleSetting;

  /**
   * Reject a variable declaration that shadows a same-name binding in an
   * enclosing scope.
   *
   * @reference https://eslint.org/docs/latest/rules/no-shadow
   */
  "no-shadow"?: TtscLintRuleSetting;

  /**
   * Reject redeclaring restricted globals (`NaN`, `Infinity`, `undefined`,
   * etc.).
   *
   * @reference https://eslint.org/docs/latest/rules/no-shadow-restricted-names
   */
  "no-shadow-restricted-names"?: TtscLintRuleSetting;

  /**
   * Reject array literals with elision (`[, 1, , 3]`), which read surprisingly
   * and rarely express intent.
   *
   * @reference https://eslint.org/docs/latest/rules/no-sparse-arrays
   */
  "no-sparse-arrays"?: TtscLintRuleSetting;

  /**
   * Reject `${expr}` inside ordinary single- or double-quoted strings — almost
   * always a missing template-literal backtick.
   *
   * @reference https://eslint.org/docs/latest/rules/no-template-curly-in-string
   */
  "no-template-curly-in-string"?: TtscLintRuleSetting;

  /**
   * Reject `this` (or `super.x`) references that precede the first `super()`
   * call in a derived constructor. The runtime throws a ReferenceError on the
   * first such access; catching it at lint time avoids a class of bugs that
   * only surface after the constructor is actually called.
   *
   * @reference https://eslint.org/docs/latest/rules/no-this-before-super
   */
  "no-this-before-super"?: TtscLintRuleSetting;

  /**
   * Reject throwing non-Error operands (`throw "boom"`, `throw 1`).
   *
   * @reference https://eslint.org/docs/latest/rules/no-throw-literal
   */
  "no-throw-literal"?: TtscLintRuleSetting;

  /**
   * Reject initializing a variable to the literal `undefined` (`let x =
   * undefined`) — declaring without an initializer has the same effect.
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
   * Reject `cond ? true : false` and similar ternaries that can be simplified
   * to a boolean coercion or the condition itself.
   *
   * @reference https://eslint.org/docs/latest/rules/no-unneeded-ternary
   */
  "no-unneeded-ternary"?: TtscLintRuleSetting;

  /**
   * Reject statements that follow an unconditional `return`, `throw`, `break`,
   * or `continue` in the same block — control flow has already left the block,
   * so any later statement is dead code.
   *
   * The conservative baseline scans the immediate statement list of a block (or
   * the top-level source / module body) only; hoistable function declarations
   * following the terminator are exempt because they are hoisted above the
   * unreachable point.
   *
   * @reference https://eslint.org/docs/latest/rules/no-unreachable
   */
  "no-unreachable"?: TtscLintRuleSetting;

  /**
   * Reject `return` and `throw` inside a `finally` block, which override any
   * earlier `return`/`throw` from the corresponding `try`/`catch`.
   *
   * @reference https://eslint.org/docs/latest/rules/no-unsafe-finally
   */
  "no-unsafe-finally"?: TtscLintRuleSetting;

  /**
   * Reject `!key in obj` and `!a instanceof B` where the `!` binds tighter than
   * the relational operator and silently coerces the left operand to a
   * boolean.
   *
   * Wrap in parens (`!(key in obj)`) when the negation is genuinely intended.
   *
   * @reference https://eslint.org/docs/latest/rules/no-unsafe-negation
   */
  "no-unsafe-negation"?: TtscLintRuleSetting;

  /**
   * Reject member access or call expressions that chain off an optional chain
   * without continuing the chain. `(obj?.foo).bar` throws a TypeError if obj is
   * null/undefined; the chain must continue with `?.` to remain safe.
   *
   * @reference https://eslint.org/docs/latest/rules/no-unsafe-optional-chaining
   */
  "no-unsafe-optional-chaining"?: TtscLintRuleSetting;

  /**
   * Reject expression statements with no observable effect, like a bare `x;`,
   * `a === b;`, or a tagged template literal statement.
   *
   * Directive prologues — the leading run of string-literal statements at the
   * top of a script, module, namespace body, or function body — are accepted
   * whatever their text (`"use strict"`, `"use client"`, …); the same strings
   * elsewhere are rejected. Productive expressions (calls, `new`, assignments,
   * updates, `delete`, `void`, `await`, `yield`) are accepted, and JSX is
   * accepted unless
   * {@link ITtscLintCoreNoUnusedExpressionsRuleOptions.enforceForJSX} is
   * enabled.
   *
   * @reference https://eslint.org/docs/latest/rules/no-unused-expressions
   */
  "no-unused-expressions"?: TtscLintRuleOptionsSetting<ITtscLintCoreNoUnusedExpressionsRuleOptions>;

  /**
   * Reject labels that no `break` or `continue` statement references.
   *
   * Usually the targeted statement was renamed or removed but the label was
   * left behind.
   *
   * @reference https://eslint.org/docs/latest/rules/no-unused-labels
   */
  "no-unused-labels"?: TtscLintRuleSetting;

  /**
   * Reject an assignment whose value is immediately overwritten by the very
   * next statement without an intervening read of the same identifier. The
   * conservative baseline only fires on two syntactically adjacent `x =
   * <expr>;` statements where the left-hand sides are the same bare identifier
   * and the second statement's right-hand side does not reference `x` itself —
   * almost always a leftover from refactoring.
   *
   * @reference https://eslint.org/docs/latest/rules/no-useless-assignment
   */
  "no-useless-assignment"?: TtscLintRuleSetting;

  /**
   * Reject unnecessary `.call()` / `.apply()` calls (such as `f.call(undefined,
   * x)`).
   *
   * @reference https://eslint.org/docs/latest/rules/no-useless-call
   */
  "no-useless-call"?: TtscLintRuleSetting;

  /**
   * Reject `catch (e) { throw e }` patterns that only rethrow the caught error
   * without adding context or handling.
   *
   * @reference https://eslint.org/docs/latest/rules/no-useless-catch
   */
  "no-useless-catch"?: TtscLintRuleSetting;

  /**
   * Reject computed property keys whose expression is a literal identifier (`{
   * ["foo"]: 1 }`).
   *
   * @reference https://eslint.org/docs/latest/rules/no-useless-computed-key
   */
  "no-useless-computed-key"?: TtscLintRuleSetting;

  /**
   * Reject `"a" + "b"` and similar concatenations where every operand is a
   * literal string.
   *
   * @reference https://eslint.org/docs/latest/rules/no-useless-concat
   */
  "no-useless-concat"?: TtscLintRuleSetting;

  /**
   * Reject empty constructor bodies (`class X { constructor() {} }`) that add
   * nothing over the implicit constructor.
   *
   * @reference https://eslint.org/docs/latest/rules/no-useless-constructor
   */
  "no-useless-constructor"?: TtscLintRuleSetting;

  /**
   * Reject unnecessary escape sequences in strings and regex literals, such as
   * `"\."` or `/\,/`. Autofixable.
   *
   * @reference https://eslint.org/docs/latest/rules/no-useless-escape
   */
  "no-useless-escape"?: TtscLintRuleSetting;

  /**
   * Reject `{ x: x }` destructuring renames that bind back to the same name.
   * Autofixable.
   *
   * @reference https://eslint.org/docs/latest/rules/no-useless-rename
   */
  "no-useless-rename"?: TtscLintRuleSetting;

  /**
   * Reject a bare `return;` whose only effect is to end a function body that
   * would have returned anyway. The conservative baseline only fires on the
   * last statement of a function-like's immediate body — earlier `return;`
   * inside a branch or loop may still be load-bearing.
   *
   * @reference https://eslint.org/docs/latest/rules/no-useless-return
   */
  "no-useless-return"?: TtscLintRuleSetting;

  /**
   * Reject `var` declarations.
   *
   * Use `let` for mutable bindings and `const` for immutable ones. Autofixable
   * to `let`.
   *
   * @reference https://eslint.org/docs/latest/rules/no-var
   */
  "no-var"?: TtscLintRuleSetting;

  /**
   * Reject `with (...)` statements.
   *
   * `with` is forbidden in strict mode (and therefore in modules), defeats
   * lexical scoping, and blocks engine optimization.
   *
   * @reference https://eslint.org/docs/latest/rules/no-with
   */
  "no-with"?: TtscLintRuleSetting;

  /**
   * Reject `{ foo: foo }` and similar object-literal shorthand candidates in
   * favor of `{ foo }`. Autofixable.
   *
   * @reference https://eslint.org/docs/latest/rules/object-shorthand
   */
  "object-shorthand"?: TtscLintRuleSetting;

  /**
   * Prefer compound assignment (`x += y`) over the long form (`x = x + y`)
   * where the two are equivalent.
   *
   * @reference https://eslint.org/docs/latest/rules/operator-assignment
   */
  "operator-assignment"?: TtscLintRuleSetting;

  /**
   * Reject `function() { ... }` expressions passed as callback arguments —
   * prefer the arrow form.
   *
   * @reference https://eslint.org/docs/latest/rules/prefer-arrow-callback
   */
  "prefer-arrow-callback"?: TtscLintRuleSetting;

  /**
   * Require `const` for lexical bindings that are never reassigned after their
   * initial value is established. Declaration-only and destructured bindings
   * follow ESLint's `ignoreReadBeforeAssign` and `destructuring` options.
   * Autofixable when one initialized declaration can safely change its shared
   * `let` keyword.
   *
   * @reference https://eslint.org/docs/latest/rules/prefer-const
   */
  "prefer-const"?: TtscLintRuleOptionsSetting<ITtscLintCorePreferConstRuleOptions>;

  /**
   * Reject single-property and single-index variable declarations (`const a =
   * obj.a`, `const x = arr[0]`) that destructuring would replace verbatim.
   *
   * @reference https://eslint.org/docs/latest/rules/prefer-destructuring
   */
  "prefer-destructuring"?: TtscLintRuleSetting;

  /**
   * Prefer the `**` operator over `Math.pow(base, exp)`.
   *
   * @reference https://eslint.org/docs/latest/rules/prefer-exponentiation-operator
   */
  "prefer-exponentiation-operator"?: TtscLintRuleSetting;

  /**
   * Prefer `for..of` over a traditional `for (let i = 0; i < arr.length; i++)`
   * loop when the index is never used inside the body.
   *
   * @reference https://eslint.org/docs/latest/rules/prefer-for-of
   */
  "prefer-for-of"?: TtscLintRuleSetting;

  /**
   * Prefer `Object.hasOwn(obj, key)` over
   * `Object.prototype.hasOwnProperty.call(obj, key)`. The new helper is
   * shorter, less error-prone, and matches the form linters elsewhere
   * recommend.
   *
   * @reference https://eslint.org/docs/latest/rules/prefer-object-has-own
   */
  "prefer-object-has-own"?: TtscLintRuleSetting;

  /**
   * Prefer object-spread `{ ...a, ...b }` over `Object.assign({}, a, b)`. Only
   * fires when the first argument is an empty object literal — mutating
   * `Object.assign(target, …)` calls are left alone because the spread form
   * does not preserve their observable side effects.
   *
   * @reference https://eslint.org/docs/latest/rules/prefer-object-spread
   */
  "prefer-object-spread"?: TtscLintRuleSetting;

  /**
   * Reject regex literals with unnamed capturing groups `(...)` — prefer named
   * groups `(?<name>...)`.
   *
   * @reference https://eslint.org/docs/latest/rules/prefer-named-capture-group
   */
  "prefer-named-capture-group"?: TtscLintRuleSetting;

  /**
   * Prefer ES2015+ numeric literal forms (`0b…`, `0o…`, `0x…`) over
   * `parseInt(string, 2 | 8 | 16)`. The literal form is shorter, type- safe at
   * lint time, and not subject to runtime radix mismatches.
   *
   * @reference https://eslint.org/docs/latest/rules/prefer-numeric-literals
   */
  "prefer-numeric-literals"?: TtscLintRuleSetting;

  /**
   * Reject reading from `arguments` in a non-arrow function body — prefer the
   * ES2015 rest-parameter form `(...args)`, which declares the variadic
   * contract on the signature and yields a real array.
   *
   * @reference https://eslint.org/docs/latest/rules/prefer-rest-params
   */
  "prefer-rest-params"?: TtscLintRuleSetting;

  /**
   * Prefer spread arguments `f(...args)` over `f.apply(null, args)`.
   *
   * Only flags `apply` calls whose `this` argument is provably the same
   * receiver (or `null` / `undefined`); calls that genuinely rebind `this` are
   * left alone.
   *
   * @reference https://eslint.org/docs/latest/rules/prefer-spread
   */
  "prefer-spread"?: TtscLintRuleSetting;

  /**
   * Prefer template literals over string concatenation when any operand is
   * non-literal.
   *
   * @reference https://eslint.org/docs/latest/rules/prefer-template
   */
  "prefer-template"?: TtscLintRuleSetting;

  /**
   * Require an explicit radix argument for `parseInt(str, radix)`.
   *
   * Without it, `"0123"` parses as decimal or octal depending on the engine.
   *
   * @reference https://eslint.org/docs/latest/rules/radix
   */
  radix?: TtscLintRuleSetting;

  /**
   * Require generator functions to contain at least one `yield`. A `yield`-less
   * generator is almost always a typo.
   *
   * @reference https://eslint.org/docs/latest/rules/require-yield
   */
  "require-yield"?: TtscLintRuleSetting;

  /**
   * Reject import specifiers within a single `import` declaration that aren't
   * alphabetically sorted.
   *
   * @reference https://eslint.org/docs/latest/rules/sort-imports
   */
  "sort-imports"?: TtscLintRuleSetting;

  /**
   * Reject object-literal property keys that aren't alphabetically sorted.
   *
   * @reference https://eslint.org/docs/latest/rules/sort-keys
   */
  "sort-keys"?: TtscLintRuleSetting;

  /**
   * Require `Number.isNaN` / `isNaN` for `NaN` checks; restrict `typeof`
   * comparisons to the documented strings.
   *
   * @reference https://eslint.org/docs/latest/rules/use-isnan
   */
  "use-isnan"?: TtscLintRuleSetting;

  /**
   * Restrict the right-hand operand of `typeof` to the documented strings
   * (`"number"`, `"object"`, ...) so `typeof x === "undefiend"` typos are
   * caught.
   *
   * @reference https://eslint.org/docs/latest/rules/valid-typeof
   */
  "valid-typeof"?: TtscLintRuleSetting;

  /**
   * Require `var` declarations to be hoisted to the top of their scope by hand,
   * mirroring how the engine treats them.
   *
   * Has no effect when `no-var` forbids `var` altogether.
   *
   * @reference https://eslint.org/docs/latest/rules/vars-on-top
   */
  "vars-on-top"?: TtscLintRuleSetting;

  /**
   * Reject Yoda-style comparisons (`if (42 === x)`); use `if (x === 42)` so the
   * variable comes first.
   *
   * @reference https://eslint.org/docs/latest/rules/yoda
   */
  yoda?: TtscLintRuleSetting;
}
