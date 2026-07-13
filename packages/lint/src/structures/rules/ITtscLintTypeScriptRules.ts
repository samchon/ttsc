import type {
  TtscLintRuleOptionsSetting,
  TtscLintRuleSetting,
} from "../TtscLintRuleSetting";
import type {
  ITtscLintTypeScriptBanTsCommentRuleOptions,
  ITtscLintTypeScriptSwitchExhaustivenessCheckRuleOptions,
} from "./ITtscLintTypeScriptRuleOptions";

/**
 * TypeScript-only rules and `@typescript-eslint` plugin equivalents, exposed
 * under the `typescript/*` namespace.
 *
 * Every rule listed here either requires TypeScript syntax (interface, `enum`,
 * `namespace`, `as`, `!`, `import type`, type parameters, declaration merging,
 * parameter properties, triple-slash references) or originates from
 * `@typescript-eslint` as a TS-aware extension that has no counterpart in plain
 * ESLint.
 *
 * Generic JS/TS rules (such as `eqeqeq`, `no-console`) stay unnamespaced in
 * {@link ITtscLintCoreRules}.
 *
 * This family deliberately mirrors `typescript-eslint`'s rule ids but **only**
 * under the `typescript/*` prefix — `@ttsc/lint` does not accept legacy bare
 * names or `@typescript-eslint/*` aliases for these rules.
 *
 * @reference https://typescript-eslint.io/rules/
 */
export interface ITtscLintTypeScriptRules {
  /**
   * Require overload declarations for the same member to be written adjacently.
   *
   * Splitting overloads with other members hides the full signature set from
   * readers and tools.
   *
   * @reference https://typescript-eslint.io/rules/adjacent-overload-signatures
   */
  "typescript/adjacent-overload-signatures"?: TtscLintRuleSetting;

  /**
   * Enforce one consistent spelling of array types.
   *
   * By default the rule prefers `T[]` / `readonly T[]` over `Array<T>` /
   * `ReadonlyArray<T>`, matching `@typescript-eslint`'s `array-type` default.
   *
   * @reference https://typescript-eslint.io/rules/array-type
   */
  "typescript/array-type"?: TtscLintRuleSetting;

  /**
   * Reject `await` on operands that are not thenable.
   *
   * Type-aware — the Checker decides whether the awaited expression has a
   * `then` method. Autofixable: drops the `await`.
   *
   * @reference https://typescript-eslint.io/rules/await-thenable
   */
  "typescript/await-thenable"?: TtscLintRuleSetting;

  /**
   * Reject `@ts-<directive>` comments, or require them to carry a description.
   *
   * With the upstream recommended defaults, `@ts-ignore` and `@ts-nocheck` are
   * reported, `@ts-check` is allowed, and `@ts-expect-error` is allowed when
   * followed by a description of at least three characters. Each directive is
   * individually configurable as `boolean`, `"allow-with-description"`, or `{
   * descriptionFormat }`, with `minimumDescriptionLength` governing the
   * description-required forms.
   *
   * @reference https://typescript-eslint.io/rules/ban-ts-comment
   */
  "typescript/ban-ts-comment"?: TtscLintRuleOptionsSetting<ITtscLintTypeScriptBanTsCommentRuleOptions>;

  /**
   * Reject `// tslint:disable` and related TSLint directive comments left
   * behind from the legacy TSLint era.
   *
   * @reference https://typescript-eslint.io/rules/ban-tslint-comment
   */
  "typescript/ban-tslint-comment"?: TtscLintRuleSetting;

  /**
   * Prefer a `static readonly` field over a `get` accessor whose body is a
   * single `return <literal>;`. The getter form re-runs the body on every read
   * and obscures that the value is fixed; a readonly field is shorter, narrows
   * to the literal type, and signals "this is a constant" at the call site.
   * Skipped when the class also declares a `set` accessor for the same member
   * name — the setter's side effects cannot be reproduced by a field.
   *
   * @reference https://typescript-eslint.io/rules/class-literal-property-style
   */
  "typescript/class-literal-property-style"?: TtscLintRuleSetting;

  /**
   * Prefer `Record<K, V>` over `{ [key: K]: V }` when an object type has a
   * single index signature and no other members.
   *
   * @reference https://typescript-eslint.io/rules/consistent-indexed-object-style
   */
  "typescript/consistent-indexed-object-style"?: TtscLintRuleSetting;

  /**
   * Prefer the `as` form of type assertions over the angle-bracket form
   * `<T>expr`, which is ambiguous inside JSX.
   *
   * @reference https://typescript-eslint.io/rules/consistent-type-assertions
   */
  "typescript/consistent-type-assertions"?: TtscLintRuleSetting;

  /**
   * Reject the redundant pattern where a variable is annotated with a generic
   * type AND the same generic arguments are repeated on the constructor: `const
   * m: Map<K, V> = new Map<K, V>()`. One of the two type-argument lists carries
   * the binding; stating both is noise.
   *
   * @reference https://typescript-eslint.io/rules/consistent-generic-constructors
   */
  "typescript/consistent-generic-constructors"?: TtscLintRuleSetting;

  /**
   * Enforce one consistent shape for object types.
   *
   * By default the rule prefers `interface` over `type` aliases for plain
   * object shapes.
   *
   * @reference https://typescript-eslint.io/rules/consistent-type-definitions
   */
  "typescript/consistent-type-definitions"?: TtscLintRuleSetting;

  /**
   * Require type-only re-exports to use `export type { ... }` instead of the
   * value form `export { ... }` when the exported binding only refers to a type
   * alias or interface in the same file. The type form has no runtime cost and
   * signals intent to the downstream import.
   *
   * @reference https://typescript-eslint.io/rules/consistent-type-exports
   */
  "typescript/consistent-type-exports"?: TtscLintRuleSetting;

  /**
   * Require imports that only reference types to use `import type {}` so the
   * import has no runtime cost.
   *
   * @reference https://typescript-eslint.io/rules/consistent-type-imports
   */
  "typescript/consistent-type-imports"?: TtscLintRuleSetting;

  /**
   * Require every exported function and method declaration to carry an explicit
   * return-type annotation. Implicit return types let downstream consumers
   * depend on inference details that can shift with future edits; the explicit
   * annotation pins the contract.
   *
   * @reference https://typescript-eslint.io/rules/explicit-function-return-type
   */
  "typescript/explicit-function-return-type"?: TtscLintRuleSetting;

  /**
   * Require an explicit accessibility modifier (`public`, `private`, or
   * `protected`) on every class member declaration. Implicit public is
   * permitted by TypeScript but obscures intent — the modifier makes the
   * encapsulation contract self-documenting. Members declared with the `#name`
   * private-hash form are exempt.
   *
   * @reference https://typescript-eslint.io/rules/explicit-member-accessibility
   */
  "typescript/explicit-member-accessibility"?: TtscLintRuleSetting;

  /**
   * Prefer a function-property signature (`f: () => void`) over a shorthand
   * method signature (`f(): void`) in interfaces and type literals so the
   * strict-function-types contravariance check applies.
   *
   * @reference https://typescript-eslint.io/rules/method-signature-style
   */
  "typescript/method-signature-style"?: TtscLintRuleSetting;

  /**
   * Reject `delete arr[i]` against array elements.
   *
   * `delete` leaves a hole; use `arr.splice` to shrink the array.
   *
   * @reference https://typescript-eslint.io/rules/no-array-delete
   */
  "typescript/no-array-delete"?: TtscLintRuleSetting;

  /**
   * Prefer `for ... of` over `Array.prototype.forEach()`. The for-of form
   * supports early termination (`break`/`return`) and `await`, while `forEach`
   * swallows both.
   *
   * @reference https://typescript-eslint.io/rules/no-array-for-each
   */
  "typescript/no-array-for-each"?: TtscLintRuleSetting;

  /**
   * Reject string-coercion contexts (`${x}`, `x + ""`, `String(x)`) where `x`
   * has a type whose `toString` resolves to the default
   * `Object.prototype.toString` and would print `"[object Object]"`.
   *
   * Type-aware via the Checker. Stringish primitives, `Date`, `Error`, arrays,
   * regexes, and any object that overrides `toString` are safe; plain `{}`
   * literals, `Record<...>` shapes, and structural interfaces with no
   * `toString` member are the ones that produce the useless default string.
   *
   * @reference https://typescript-eslint.io/rules/no-base-to-string
   */
  "typescript/no-base-to-string"?: TtscLintRuleSetting;

  /**
   * Reject classes that exist purely as a namespace for static members or that
   * are entirely empty. A namespace import or plain functions are clearer than
   * `class Util { static foo() {} }` — the class adds indirection without
   * providing instance behavior.
   *
   * @reference https://typescript-eslint.io/rules/no-extraneous-class
   */
  "typescript/no-extraneous-class"?: TtscLintRuleSetting;

  /**
   * Reject non-null assertions placed where they visually merge with a
   * following operator — `a! == b` (reads as `!=`), `a! in b`, or `a!
   * instanceof B`.
   *
   * Wrap the assertion in parentheses (`(a!) == b`) or drop it entirely.
   *
   * @reference https://typescript-eslint.io/rules/no-confusing-non-null-assertion
   */
  "typescript/no-confusing-non-null-assertion"?: TtscLintRuleSetting;

  /**
   * Reject `void X` expressions used in any position where the surrounding
   * context expects a value — initializer, call argument, `return` operand,
   * conditional, binary, or ternary subexpression.
   *
   * The only acceptable positions are an expression statement (`void x;`), an
   * arrow function's concise body (`() => void x`), and the operand of an
   * enclosing `void` operator (`void void x`).
   *
   * @reference https://typescript-eslint.io/rules/no-confusing-void-expression
   */
  "typescript/no-confusing-void-expression"?: TtscLintRuleSetting;

  /**
   * Reject references to declarations marked `@deprecated` in their JSDoc.
   *
   * Type-aware via the Checker. The rule resolves the symbol at each
   * identifier, property access, call, `new`, or JSX tag-name location, walks
   * the symbol's declarations for an attached `@deprecated` JSDoc tag, and
   * reports at the reference. References inside the same declaration block as
   * the deprecation marker are skipped so the deprecation site itself doesn't
   * fire.
   *
   * @reference https://typescript-eslint.io/rules/no-deprecated
   */
  "typescript/no-deprecated"?: TtscLintRuleSetting;

  /**
   * Reject `enum` declarations whose members share the same literal value.
   *
   * Reverse lookup (`E[E.X]`) returns whichever member is listed last, so
   * duplicates almost always reflect a copy-paste mistake.
   *
   * @reference https://typescript-eslint.io/rules/no-duplicate-enum-values
   */
  "typescript/no-duplicate-enum-values"?: TtscLintRuleSetting;

  /**
   * Reject computed bracket-key `delete` expressions (`delete obj[x]`) where
   * `x` is not a string literal, since these escape type tracking.
   *
   * @reference https://typescript-eslint.io/rules/no-dynamic-delete
   */
  "typescript/no-dynamic-delete"?: TtscLintRuleSetting;

  /**
   * Reject empty `interface` declarations.
   *
   * An empty interface that does not `extends` anything is equivalent to
   * `unknown` and almost always represents incomplete typing work.
   *
   * @reference https://typescript-eslint.io/rules/no-empty-interface
   */
  "typescript/no-empty-interface"?: TtscLintRuleSetting;

  /**
   * Reject `{}` as a type annotation.
   *
   * `{}` matches every non-nullish value and is almost never intended; use
   * `Record<string, unknown>` for a generic object, or `object` for any
   * non-primitive.
   *
   * @reference https://typescript-eslint.io/rules/no-empty-object-type
   */
  "typescript/no-empty-object-type"?: TtscLintRuleSetting;

  /**
   * Reject `any` type annotations.
   *
   * Typically configured as `"warning"` during incremental migrations.
   *
   * @reference https://typescript-eslint.io/rules/no-explicit-any
   */
  "typescript/no-explicit-any"?: TtscLintRuleSetting;

  /**
   * Reject `x!!` — chained non-null assertions where the inner one already
   * removes nullability. Autofixable: drops the extra `!`.
   *
   * @reference https://typescript-eslint.io/rules/no-extra-non-null-assertion
   */
  "typescript/no-extra-non-null-assertion"?: TtscLintRuleSetting;

  /**
   * Reject Promise-typed expressions whose result is discarded — most often a
   * bare `getPromise();` expression statement.
   *
   * Type-aware via the Checker. A floating promise loses its rejection channel
   * and runs out of order with surrounding code. Acceptable sinks are `await`,
   * `.catch(...)`, `.then(_, onRejected)`, `.finally(...)`, assignment, the
   * `void` operator, and `return`.
   *
   * @reference https://typescript-eslint.io/rules/no-floating-promises
   */
  "typescript/no-floating-promises"?: TtscLintRuleSetting;

  /**
   * Reject `for (const k in arr)` where `arr` is statically typed as an array
   * or tuple.
   *
   * Type-aware via the Checker. `for...in` iterates enumerable property names
   * (yielded as strings, including any inherited or custom-added members), not
   * array values or numeric indices — almost always a mistake for `for...of`,
   * `Array#forEach`, or an indexed `for` loop.
   *
   * @reference https://typescript-eslint.io/rules/no-for-in-array
   */
  "typescript/no-for-in-array"?: TtscLintRuleSetting;

  /**
   * Hoist inline `type` modifiers on individual imports into a single top-level
   * `import type {}`. Autofixable.
   *
   * @reference https://typescript-eslint.io/rules/no-import-type-side-effects
   */
  "typescript/no-import-type-side-effects"?: TtscLintRuleSetting;

  /**
   * Reject explicit type annotations that TypeScript can already infer from the
   * initializer (`const x: number = 1`).
   *
   * @reference https://typescript-eslint.io/rules/no-inferrable-types
   */
  "typescript/no-inferrable-types"?: TtscLintRuleSetting;

  /**
   * Reject `void` used as anything other than a function return type. `void` in
   * a union (`string | void`) or as a non-allow-listed generic argument is
   * almost always a confusion with `undefined`. Allowed positions:
   * function/method/arrow return-type annotations and generic arguments to
   * `Promise` / `Generator` / `AsyncGenerator` / `Iterator` / `AsyncIterator` /
   * `IterableIterator` / `AsyncIterableIterator`.
   *
   * @reference https://typescript-eslint.io/rules/no-invalid-void-type
   */
  "typescript/no-invalid-void-type"?: TtscLintRuleSetting;

  /**
   * TypeScript-aware extension of `no-magic-numbers` that additionally ignores
   * enum member values.
   *
   * @reference https://typescript-eslint.io/rules/no-magic-numbers
   */
  "typescript/no-magic-numbers"?: TtscLintRuleSetting;

  /**
   * Reject `void X` where `X` is already statically typed `void` — the `void`
   * operator adds nothing because the operand already evaluates to `undefined`.
   * The operator is meaningful only on a value- returning expression that the
   * caller wants to discard.
   *
   * Type-aware — the Checker decides whether the operand carries the `void`
   * type. The upstream `checkNever` option is left at its default of `false`:
   * only `void`-typed operands trigger, `never` does not.
   *
   * @reference https://typescript-eslint.io/rules/no-meaningless-void-operator
   */
  "typescript/no-meaningless-void-operator"?: TtscLintRuleSetting;

  /**
   * Reject signatures that fake a constructor or an instance `new` method —
   * `interface I { new (): I }` (TypeScript treats this as the type of `new
   * I()` regardless of intent) and `class C { new(): C }`.
   *
   * Use a separate construct signature on a factory type when the intent is
   * "anything callable with `new`".
   *
   * @reference https://typescript-eslint.io/rules/no-misused-new
   */
  "typescript/no-misused-new"?: TtscLintRuleSetting;

  /**
   * Reject Promise values supplied where a non-Promise was expected.
   *
   * Covers conditional positions (`if (promise)`, `while`, `for`, ternary,
   * `&&`, `||`, `??`) where the Promise is truthy by reference, and `async`
   * callbacks passed to APIs that expect a void-returning function (e.g.
   * `Array#forEach`, JSX event handlers), where the returned Promise is
   * silently dropped.
   *
   * @reference https://typescript-eslint.io/rules/no-misused-promises
   */
  "typescript/no-misused-promises"?: TtscLintRuleSetting;

  /**
   * Reject spread expressions whose operand is syntactically wrong for the
   * surrounding context.
   *
   * AST-only subset of the upstream rule — no Checker required. Fires on object
   * literal spread inside an array literal or a call/construct argument (`[...{
   * a: 1 }]`, `f(...{ a: 1 })`) and on array literal spread inside an object
   * literal (`{ ...[1, 2] }`). General iterability detection still needs the
   * full type-aware rule.
   *
   * @reference https://typescript-eslint.io/rules/no-misused-spread
   */
  "typescript/no-misused-spread"?: TtscLintRuleSetting;

  /**
   * Reject `enum`s that mix numeric and string members, which makes the
   * resulting type unsafe for reverse lookups.
   *
   * @reference https://typescript-eslint.io/rules/no-mixed-enums
   */
  "typescript/no-mixed-enums"?: TtscLintRuleSetting;

  /**
   * Reject non-ambient `namespace` and `module Foo {}` declarations in regular
   * `.ts` files.
   *
   * ES modules replace the legacy namespace concept; ambient `declare
   * namespace` in `.d.ts` files stays allowed by default for global typings
   * compatibility.
   *
   * @reference https://typescript-eslint.io/rules/no-namespace
   */
  "typescript/no-namespace"?: TtscLintRuleSetting;

  /**
   * Reject `x! ?? y` — the `!` collapses `null | undefined` to a non-nullish
   * value, so the `??` branch is unreachable.
   *
   * @reference https://typescript-eslint.io/rules/no-non-null-asserted-nullish-coalescing
   */
  "typescript/no-non-null-asserted-nullish-coalescing"?: TtscLintRuleSetting;

  /**
   * Reject `x!?.y` — the non-null assertion makes the optional chain
   * meaningless because the inner expression is already known to be defined.
   *
   * @reference https://typescript-eslint.io/rules/no-non-null-asserted-optional-chain
   */
  "typescript/no-non-null-asserted-optional-chain"?: TtscLintRuleSetting;

  /**
   * Reject postfix `!` non-null assertions altogether.
   *
   * The operator suppresses a real `null` / `undefined` possibility without
   * inserting a check; prefer a narrowing branch, optional chaining, or
   * refining the type at its source.
   *
   * @reference https://typescript-eslint.io/rules/no-non-null-assertion
   */
  "typescript/no-non-null-assertion"?: TtscLintRuleSetting;

  /**
   * Reject union and intersection type constituents that the type system
   * absorbs anyway — `string | any` collapses to `any`, `T & never` collapses
   * to `never`, `T & unknown` collapses to `T`, and repeated constituents add
   * nothing.
   *
   * AST-only baseline: only the literal `any` / `unknown` / `never` keyword
   * constituents and duplicates matched by textual identity are reported.
   * Subset relations such as `string | "foo"` and generic alias resolution
   * still require the type-aware path.
   *
   * @reference https://typescript-eslint.io/rules/no-redundant-type-constituents
   */
  "typescript/no-redundant-type-constituents"?: TtscLintRuleSetting;

  /**
   * Reject specific type-reference names that are almost always a mistake — by
   * default the global wrapper types `Object`, `Function`, `Number`, `String`,
   * and `Boolean`. The lowercase primitives (`number`, `string`, `boolean`) and
   * explicit call signatures convey the intended type without the
   * runtime-boxing semantics that the wrapper names imply.
   *
   * AST-only baseline: shadow guard reuses the same file-scope check as
   * `no-wrapper-object-types` so a user-declared `interface String {}` is not
   * flagged as the global wrapper.
   *
   * @reference https://typescript-eslint.io/rules/no-restricted-types
   */
  "typescript/no-restricted-types"?: TtscLintRuleSetting;

  /**
   * Reject `require(...)` calls and `import x = require(...)` declarations.
   *
   * Use ES module `import` syntax so the type-only / runtime-import distinction
   * is preserved and declaration shape stays consistent.
   *
   * @reference https://typescript-eslint.io/rules/no-require-imports
   */
  "typescript/no-require-imports"?: TtscLintRuleSetting;

  /**
   * Reject aliasing `this` to a local (`const self = this`, `const that =
   * this`, destructuring `const { x } = this`).
   *
   * Arrow functions and `.bind(this)` make the workaround unnecessary; the
   * alias also breaks type narrowing on `this`.
   *
   * @reference https://typescript-eslint.io/rules/no-this-alias
   */
  "typescript/no-this-alias"?: TtscLintRuleSetting;

  /**
   * Reject direct comparison of a boolean-typed value with `true` / `false`
   * literals — `x === true` is just `x`, `x !== false` is just `x`. The literal
   * compare adds noise without changing the result whenever the non-literal
   * side is provably pure boolean.
   *
   * Type-aware via the Checker. Skipped when the value side carries `null` /
   * `undefined` — the literal compare is also stripping nullability there, and
   * the rewrite would lose information.
   *
   * @reference https://typescript-eslint.io/rules/no-unnecessary-boolean-literal-compare
   */
  "typescript/no-unnecessary-boolean-literal-compare"?: TtscLintRuleSetting;

  /**
   * Reject conditions whose static type proves the runtime truthiness is fixed
   * — `if ({})`, `if (null)`, `while ("")`, `0 && f()`. The conditional becomes
   * either dead code (the always-false arm) or unconditional execution (the
   * always-true arm); the explicit shape (`if (true)`, deleting the dead
   * branch, or widening the type) names the intent.
   *
   * Type-aware via the Checker. The rule stays silent on `any`, `unknown`,
   * plain `boolean`, plain `string`, plain `number`, unions that mix truthy and
   * falsy outcomes, and any other shape whose runtime truthiness is not
   * statically decidable — only the provably always-truthy / always-falsy
   * positions are flagged.
   *
   * @reference https://typescript-eslint.io/rules/no-unnecessary-condition
   */
  "typescript/no-unnecessary-condition"?: TtscLintRuleSetting;

  /**
   * Reject `this.x = x` in a constructor body when `x` is already declared as a
   * parameter property — TypeScript performs the assignment automatically.
   *
   * @reference https://typescript-eslint.io/rules/no-unnecessary-parameter-property-assignment
   */
  "typescript/no-unnecessary-parameter-property-assignment"?: TtscLintRuleSetting;

  /**
   * Reject `Foo.Bar` references written inside `namespace Foo { ... }` or `enum
   * Foo { ..., X = Foo.Y, ... }` where the `Foo.` qualifier names the same
   * lexical scope the access lives in. Dropping the qualifier leaves the
   * identical binding lookup.
   *
   * AST-only: walks `Parent` links for an enclosing namespace or enum
   * declaration whose identifier matches the qualifier's head. The Checker is
   * not required because the upstream rule operates on lexical scope identity,
   * which the AST already encodes via declaration ancestry.
   *
   * @reference https://typescript-eslint.io/rules/no-unnecessary-qualifier
   */
  "typescript/no-unnecessary-qualifier"?: TtscLintRuleSetting;

  /**
   * Reject template literals that carry no template-only behavior — a
   * `${"abc"}` interpolation, a lone `${name}` span around a string-typed
   * value, or a `abc` no-substitution literal with no escaped backticks. Each
   * of these collapses to a regular string literal without changing meaning, so
   * the backtick form is just noise.
   *
   * Type-aware via the Checker. The interpolation forms are flagged only when
   * the span's expression statically resolves to a string-like type and the
   * surrounding head / tail text is empty — the runtime coercion is then a
   * no-op, mirroring the upstream rule.
   *
   * @reference https://typescript-eslint.io/rules/no-unnecessary-template-expression
   */
  "typescript/no-unnecessary-template-expression"?: TtscLintRuleSetting;

  /**
   * Reject `Foo<DefaultT>` calls where the supplied generic argument is the
   * same as the parameter's default — the argument adds nothing.
   *
   * Type-aware via the Checker. Walks the resolved type parameters of the
   * call's signature and compares each explicit argument against the
   * parameter's declared default. Only the contiguous trailing run of
   * default-equal arguments is reported — TypeScript can only omit a suffix of
   * the type-argument list.
   *
   * @reference https://typescript-eslint.io/rules/no-unnecessary-type-arguments
   */
  "typescript/no-unnecessary-type-arguments"?: TtscLintRuleSetting;

  /**
   * Reject `x as T` and `<T>x` assertions whose target type is the same as
   * `x`'s already-known static type — the assertion adds nothing.
   *
   * Also rejects `x!` non-null assertions when `x` is already statically
   * non-nullable. The `as const` syntax is excluded because it produces a
   * strictly different type and is handled by the `prefer-as-const` rule.
   *
   * Type-aware via the Checker.
   *
   * @reference https://typescript-eslint.io/rules/no-unnecessary-type-assertion
   */
  "typescript/no-unnecessary-type-assertion"?: TtscLintRuleSetting;

  /**
   * Reject `<T extends unknown>` and similar constraints that match everything.
   * Autofixable: drops the constraint.
   *
   * @reference https://typescript-eslint.io/rules/no-unnecessary-type-constraint
   */
  "typescript/no-unnecessary-type-constraint"?: TtscLintRuleSetting;

  /**
   * Reject passing an `any`-typed value into a parameter whose type is
   * concrete. The call still runs, but every static guarantee the function's
   * signature would otherwise enforce is silently dropped.
   *
   * Type-aware via the Checker. `unknown` is not flagged.
   *
   * @reference https://typescript-eslint.io/rules/no-unsafe-argument
   */
  "typescript/no-unsafe-argument"?: TtscLintRuleSetting;

  /**
   * Reject assigning an `any`-typed value into a concretely typed location —
   * variable initializer with an explicit annotation, or a reassignment whose
   * left-hand side has a static type.
   *
   * Type-aware via the Checker. `unknown` is not flagged.
   *
   * @reference https://typescript-eslint.io/rules/no-unsafe-assignment
   */
  "typescript/no-unsafe-assignment"?: TtscLintRuleSetting;

  /**
   * Reject calling a value whose static type is `any`. The runtime call still
   * happens, but the signature is unchecked and the return type spreads `any`
   * to every downstream use.
   *
   * Type-aware via the Checker. Visits plain calls, `new`, and tagged
   * templates. `unknown` is not flagged.
   *
   * @reference https://typescript-eslint.io/rules/no-unsafe-call
   */
  "typescript/no-unsafe-call"?: TtscLintRuleSetting;

  /**
   * Reject declaration merging between an `interface` and a `class` with the
   * same name.
   *
   * The interface grafts members onto the class type without forcing a runtime
   * implementation, so the class object lies about what it exposes.
   *
   * @reference https://typescript-eslint.io/rules/no-unsafe-declaration-merging
   */
  "typescript/no-unsafe-declaration-merging"?: TtscLintRuleSetting;

  /**
   * Reject `==` / `===` / `!=` / `!==` comparisons between an enum-typed value
   * and a plain `number` or `string` of the same widened primitive — the
   * comparison silently accepts unrelated enums and raw literals that happen to
   * share the underlying primitive.
   *
   * Type-aware via the Checker. The rule fires when one side carries an enum
   * type and the other is the widened primitive without naming the same enum;
   * comparisons against members of the same enum, and against `any` / `unknown`
   * / `never` (to keep generic helpers quiet), pass through.
   *
   * @reference https://typescript-eslint.io/rules/no-unsafe-enum-comparison
   */
  "typescript/no-unsafe-enum-comparison"?: TtscLintRuleSetting;

  /**
   * Reject the unsafe `Function` type, which matches every callable regardless
   * of signature.
   *
   * Declare the specific call signature instead.
   *
   * @reference https://typescript-eslint.io/rules/no-unsafe-function-type
   */
  "typescript/no-unsafe-function-type"?: TtscLintRuleSetting;

  /**
   * Reject property access on a receiver whose static type is `any`. The lookup
   * still resolves at runtime, but the property type is `any` and spreads
   * through the rest of the program.
   *
   * Type-aware via the Checker. Visits dot access and computed element access.
   * `unknown` is not flagged.
   *
   * @reference https://typescript-eslint.io/rules/no-unsafe-member-access
   */
  "typescript/no-unsafe-member-access"?: TtscLintRuleSetting;

  /**
   * Reject a `return` expression whose static type is `any` from a function
   * whose declared return type is a concrete (non-`any` / non-`unknown` /
   * non-`void`) shape — the `any` leaks past the type boundary and disables
   * every downstream check on the returned value.
   *
   * Type-aware via the Checker. The rule walks each `return` to its enclosing
   * function-like declaration, asks the Checker for that function's signature,
   * and compares the declared return type against the expression type.
   * `unknown`-typed expressions pass through because they cannot be used
   * without further narrowing.
   *
   * @reference https://typescript-eslint.io/rules/no-unsafe-return
   */
  "typescript/no-unsafe-return"?: TtscLintRuleSetting;

  /**
   * Reject the unary `-` operator applied to an operand whose static type is
   * not number-like or bigint-like — `-x` silently coerces strings, objects,
   * and other shapes via `Number(x)` and almost always indicates a bug.
   *
   * Type-aware via the Checker. `any` / `unknown` / `never` operands pass
   * through to match the upstream `allowAny`-style defaults that keep generic
   * helpers quiet.
   *
   * @reference https://typescript-eslint.io/rules/no-unsafe-unary-minus
   */
  "typescript/no-unsafe-unary-minus"?: TtscLintRuleSetting;

  /**
   * TypeScript-aware extension of `no-useless-constructor` that tolerates a
   * constructor existing solely to expose parameter properties.
   *
   * @reference https://typescript-eslint.io/rules/no-useless-constructor
   */
  "typescript/no-useless-constructor"?: TtscLintRuleSetting;

  /**
   * Reject redundant `export {}` declarations in module files.
   *
   * The file is already a module via its other top-level `import` / `export`.
   *
   * @reference https://typescript-eslint.io/rules/no-useless-empty-export
   */
  "typescript/no-useless-empty-export"?: TtscLintRuleSetting;

  /**
   * Reject the wrapper object types `String`, `Number`, `Boolean`, `Symbol`,
   * and `BigInt`.
   *
   * Autofixable to the corresponding primitive. `Object` stays detection-only
   * because it has slightly different semantics.
   *
   * @reference https://typescript-eslint.io/rules/no-wrapper-object-types
   */
  "typescript/no-wrapper-object-types"?: TtscLintRuleSetting;

  /**
   * Reject `x as Foo` assertions whose target type is the non-nullable version
   * of `x`'s static type — replace with the shorter `x!` non-null assertion.
   *
   * Type-aware via the Checker. Fires when the source expression's static type
   * is `Foo | null`, `Foo | undefined`, or `Foo | null | undefined`, and the
   * asserted type equals the non-nullable subset.
   *
   * @reference https://typescript-eslint.io/rules/non-nullable-type-assertion-style
   */
  "typescript/non-nullable-type-assertion-style"?: TtscLintRuleSetting;

  /**
   * Reject `throw X` where `X` is statically known not to derive from `Error` —
   * string literals, numbers, plain object literals, and the like.
   *
   * Type-aware via the Checker. Non-Error throws lose the stack trace and
   * confuse `instanceof` checks in the surrounding `catch`.
   *
   * @reference https://typescript-eslint.io/rules/only-throw-error
   */
  "typescript/only-throw-error"?: TtscLintRuleSetting;

  /**
   * Reject TypeScript parameter-property constructors (`constructor(public foo:
   * T)`) — prefer plain field declarations so the class shape is visible from
   * the member list instead of buried inside the constructor parameter list.
   *
   * AST-only — the trigger is a syntactic modifier (`public` / `private` /
   * `protected` / `readonly` / `override`) on a constructor parameter.
   *
   * @reference https://typescript-eslint.io/rules/parameter-properties
   */
  "typescript/parameter-properties"?: TtscLintRuleSetting;

  /**
   * Prefer `as const` over literal type assertions (`as "literal"`,
   * `<"literal">`) and matching literal type annotations on variable and
   * class-property declarations. Literals are compared by raw source spelling.
   * Assertions are autofixable; annotation findings are detection-only
   * (upstream offers only a suggestion, never a fix).
   *
   * @reference https://typescript-eslint.io/rules/prefer-as-const
   */
  "typescript/prefer-as-const"?: TtscLintRuleSetting;

  /**
   * Require every `enum` member to have an explicit initializer.
   *
   * Implicit auto-increment is fine for novelty enums but dangerous once a
   * value gets persisted.
   *
   * @reference https://typescript-eslint.io/rules/prefer-enum-initializers
   */
  "typescript/prefer-enum-initializers"?: TtscLintRuleSetting;

  /**
   * Prefer `arr.find(predicate)` over `arr.filter(predicate)[0]` and
   * `arr.filter(predicate).at(0)`.
   *
   * Type-aware via the Checker. Fires only when the receiver of `filter` is
   * provably an array or tuple. `find` short-circuits on the first match
   * instead of materializing the whole filtered array, so it expresses the "get
   * me the first match" intent more directly and is strictly faster on large
   * inputs. Non-zero index accesses (`[1]`, `.at(1)`, ...) are intentionally
   * skipped because `find` cannot express them.
   *
   * @reference https://typescript-eslint.io/rules/prefer-find
   */
  "typescript/prefer-find"?: TtscLintRuleSetting;

  /**
   * Prefer a type alias over an interface that declares only a single call
   * signature — the type form composes better with structural typing.
   *
   * @reference https://typescript-eslint.io/rules/prefer-function-type
   */
  "typescript/prefer-function-type"?: TtscLintRuleSetting;

  /**
   * Prefer `array.includes(x)` over `array.indexOf(x) !== -1` (and the matching
   * `=== -1`, `>= 0`, `< 0`, `> -1` shapes).
   *
   * Type-aware via the Checker. Fires only when the receiver of `indexOf` is
   * provably an array, tuple, or string. The `includes`-style call states the
   * intent directly and avoids the sentinel-vs-position confusion that comes
   * with comparing an `indexOf` return value against `-1`.
   *
   * @reference https://typescript-eslint.io/rules/prefer-includes
   */
  "typescript/prefer-includes"?: TtscLintRuleSetting;

  /**
   * Prefer literal initializers (`= 0`, `= "FOO"`) for enum members over
   * computed expressions, so the value is decidable at compile time.
   *
   * @reference https://typescript-eslint.io/rules/prefer-literal-enum-member
   */
  "typescript/prefer-literal-enum-member"?: TtscLintRuleSetting;

  /**
   * Prefer the `namespace` keyword over the legacy `module Foo {}` form.
   * Autofixable.
   *
   * @reference https://typescript-eslint.io/rules/prefer-namespace-keyword
   */
  "typescript/prefer-namespace-keyword"?: TtscLintRuleSetting;

  /**
   * Prefer `??` over `||` (and `??=` over `||=`, and `??` over the ternary `x ?
   * x : y`) when the intent is to default `null` / `undefined`.
   *
   * `||` short-circuits on every falsy value (0, "", false, NaN), so "default
   * this if missing" silently coerces legitimate zeros and empty strings. The
   * AST-only baseline skips operands the surrounding context already coerces to
   * boolean (`if (a || b)`, `!(a || b)`, ternary condition, etc.).
   *
   * @reference https://typescript-eslint.io/rules/prefer-nullish-coalescing
   */
  "typescript/prefer-nullish-coalescing"?: TtscLintRuleSetting;

  /**
   * Prefer an optional chain (`a?.b?.c`) over chained boolean guards such as `a
   * && a.b && a.b.c` or `a != null && a.b`.
   *
   * The optional-chain form is shorter and short-circuits to `undefined`
   * instead of the leftmost falsy value, which is almost always the intent when
   * guarding a property access against a nullish base. AST-only: the rule
   * matches by the textual identity of the guard against the receiver of the
   * right-hand access, and skips chains that cross a call expression with
   * arguments.
   *
   * @reference https://typescript-eslint.io/rules/prefer-optional-chain
   */
  "typescript/prefer-optional-chain"?: TtscLintRuleSetting;

  /**
   * Reject `Promise.reject(value)` where `value` is statically known not to
   * derive from `Error` — string literals, numbers, plain primitives, and the
   * like.
   *
   * Type-aware via the Checker. Mirrors `typescript/only-throw-error` for the
   * rejection side of the promise contract: a non-Error rejection loses the
   * structured stack trace and breaks downstream `instanceof Error` checks in
   * `.catch(...)` / `try { await … } catch (err)` handlers. Covers
   * `Promise.reject(arg)`, `<promise>.reject(arg)` on a Promise-typed receiver,
   * and `reject(arg)` calls bound to the second parameter of a `new Promise((_,
   * reject) => …)` executor. `any` and `unknown` pass through, matching
   * upstream's `allowThrowingAny` / `allowThrowingUnknown` defaults.
   *
   * @reference https://typescript-eslint.io/rules/prefer-promise-reject-errors
   */
  "typescript/prefer-promise-reject-errors"?: TtscLintRuleSetting;

  /**
   * Reject private class fields that could carry `readonly`.
   *
   * AST-only baseline: fires on a `PropertyDeclaration` inside a class body
   * that is `private` (or uses the `#name` private-hash form), does not already
   * carry `readonly`, and is initialized at the declaration site. A field
   * initialized at declaration time is set before the constructor runs, so
   * locking it as `readonly` rules out accidental reassignments without
   * changing runtime behavior. The fully type-aware upstream rule also walks
   * assignments inside the constructor and other methods; the AST baseline
   * targets the narrow but safe shape.
   *
   * @reference https://typescript-eslint.io/rules/prefer-readonly
   */
  "typescript/prefer-readonly"?: TtscLintRuleSetting;

  /**
   * Prefer `arr.reduce<T>(callback, initial)` over the assertion-on-
   * initial-value pattern `arr.reduce(callback, initial as T)`.
   *
   * Type-aware via the Checker. The accumulator type bound through a call-site
   * type parameter constrains the callback's accumulator parameter directly; an
   * `as` on the seed only widens the runtime value and lets the callback infer
   * the accumulator's parameter type from the seed's widened literal shape
   * instead. The rule fires only when the `.reduce` receiver is provably an
   * array or tuple, the call has no existing type arguments, and the second
   * argument is an `as` or angle-bracket type assertion.
   *
   * @reference https://typescript-eslint.io/rules/prefer-reduce-type-parameter
   */
  "typescript/prefer-reduce-type-parameter"?: TtscLintRuleSetting;

  /**
   * Prefer `re.exec(str)` over `str.match(re)` when the regex has no `g` flag.
   *
   * Type-aware via the Checker. Both shapes return the same `RegExpExecArray |
   * null` for first-match queries, but `String#match` silently switches to
   * "every match" the moment the regex gains the `g` flag — a typo at the regex
   * literal changes the call's return shape from `[fullMatch, ...captures]` to
   * a flat `string[]` of matches. The AST-only baseline reads the flag suffix
   * off the regex literal directly; non-literal regex arguments (a `new
   * RegExp(...)`, a variable holding `/.../`) are conservatively skipped
   * because static flag tracking would explode in scope.
   *
   * @reference https://typescript-eslint.io/rules/prefer-regexp-exec
   */
  "typescript/prefer-regexp-exec"?: TtscLintRuleSetting;

  /**
   * When an instance method always `return this`, declare its return type as
   * `this` instead of the enclosing class name so subclass call sites keep the
   * narrower receiver type and method-chaining stays polymorphic.
   *
   * Type-aware via the Checker. Fires only when the method declares an explicit
   * non-`this` return-type annotation AND every value-returning `return`
   * statement in the body returns exactly `this`. Methods with no annotation,
   * methods with at least one non-`this` return, `async` methods, generators,
   * constructors, accessors, and static methods are skipped — each has
   * return-shape semantics the `this` rewrite does not preserve.
   *
   * @reference https://typescript-eslint.io/rules/prefer-return-this-type
   */
  "typescript/prefer-return-this-type"?: TtscLintRuleSetting;

  /**
   * Prefer `str.startsWith(prefix)` / `str.endsWith(suffix)` over the `indexOf`
   * / `lastIndexOf` and anchored-regex idioms — `str.indexOf(p) === 0`,
   * `str.indexOf(p, str.length - p.length) !== -1`, `str.lastIndexOf(p) ===
   * str.length - p.length`, `/^prefix/.test(str)`, and `/suffix$/.test(str)`.
   *
   * Type-aware via the Checker. Fires only when the string-position subject is
   * provably a `string`-like type. The dedicated methods state the intent
   * directly and avoid the off-by-one arithmetic and regex-anchor pitfalls of
   * the older shapes.
   *
   * @reference https://typescript-eslint.io/rules/prefer-string-starts-ends-with
   */
  "typescript/prefer-string-starts-ends-with"?: TtscLintRuleSetting;

  /**
   * Require functions whose return type is `Promise<T>` (or a Promise-like
   * thenable) to be declared with the `async` keyword.
   *
   * Type-aware via the Checker. An `async` function wraps a synchronous `throw`
   * into a rejected Promise so the caller's `await` / `.catch(...)` observes
   * it; the non-async equivalent throws synchronously and bypasses every
   * Promise-aware handler downstream. Marking the function `async` keeps the
   * rejection channel consistent with the declared return type. Overload
   * signatures, abstract methods, and declaration-merging hosts (functions with
   * no body) are skipped — there is no body to wrap.
   *
   * @reference https://typescript-eslint.io/rules/promise-function-async
   */
  "typescript/promise-function-async"?: TtscLintRuleSetting;

  /**
   * Reject a `get` accessor whose declared return type does not match the
   * parameter type of its companion `set` accessor on the same class. The
   * accessor pair presents a single conceptual field to callers — `obj.x = v`
   * followed by `w = obj.x` should round-trip with compatible types — but
   * TypeScript otherwise lets the two accessors carry independent annotations.
   *
   * Type-aware. The comparison resolves both sides through the Checker so type
   * aliases, generic parameters, and union constituents collapse to the same
   * set of values before equality is decided.
   *
   * @reference https://typescript-eslint.io/rules/related-getter-setter-pairs
   */
  "typescript/related-getter-setter-pairs"?: TtscLintRuleSetting;

  /**
   * Require `arr.sort()` and `arr.toSorted()` calls to pass an explicit
   * `compareFunction`.
   *
   * Without a comparator both methods coerce elements to strings and sort
   * lexically, so `[10, 2, 1].sort()` returns `[1, 10, 2]` — almost never the
   * intent. Type-aware via the Checker: only fires when the receiver is
   * provably an array or tuple, so user-defined methods named `sort` /
   * `toSorted` on non-array types do not trigger the rule.
   *
   * @reference https://typescript-eslint.io/rules/require-array-sort-compare
   */
  "typescript/require-array-sort-compare"?: TtscLintRuleSetting;

  /**
   * Reject `async` functions whose body contains no `await` expression.
   *
   * An async function with no `await` only inflates the return type to
   * `Promise<T>` without doing any asynchronous work; collapse it to a sync
   * function. Async generators are accepted as long as they have at least one
   * `yield`.
   *
   * @reference https://typescript-eslint.io/rules/require-await
   */
  "typescript/require-await"?: TtscLintRuleSetting;

  /**
   * Reject `+` expressions whose operands are not both `number`, both `string`,
   * or both `bigint`.
   *
   * Type-aware via the Checker. `1 + "a"`, `null + 5`, and `obj + 1` are
   * silently coerced by the runtime — almost always a bug. Mixed
   * `number`/`string` concatenations are likewise rejected: the author should
   * convert explicitly with `String(x)` or use a template literal.
   *
   * @reference https://typescript-eslint.io/rules/restrict-plus-operands
   */
  "typescript/restrict-plus-operands"?: TtscLintRuleSetting;

  /**
   * Reject template-literal interpolations whose expression carries a type that
   * does not stringify cleanly — `${obj}` prints `"[object Object]"`, `${null}`
   * prints `"null"`, and so on.
   *
   * Type-aware via the Checker. Each `${...}` span's type must be string-like,
   * number-like, bigint-like, or boolean-like; `any`, `unknown`, and `never`
   * pass through to avoid false positives on generic helpers, matching upstream
   * `allowAny` / `allowNever` defaults. Union and intersection types must have
   * every constituent stringify cleanly.
   *
   * @reference https://typescript-eslint.io/rules/restrict-template-expressions
   */
  "typescript/restrict-template-expressions"?: TtscLintRuleSetting;

  /**
   * Reject `return promise` inside `try`, `catch`, or `finally`; require
   * `return await promise`.
   *
   * Without the `await`, the surrounding handler unbinds before the promise
   * settles, so a rejection skips the `catch` block entirely and the `finally`
   * cleanup races the result.
   *
   * @reference https://typescript-eslint.io/rules/return-await
   */
  "typescript/return-await"?: TtscLintRuleSetting;

  /**
   * Require union and intersection type constituents to be listed in a
   * canonical group order — keyword primitives alphabetized first, named /
   * object references alphabetized next, `null` / `undefined` last. Two authors
   * writing the same set of values can otherwise disagree on the spelling, and
   * the canonical order eliminates that discussion from review.
   *
   * AST-only baseline: ordering is decided by syntactic group (keyword
   * primitive vs. named reference vs. nullish) and a within-group source-text
   * sort. Nested unions / intersections are skipped — only the outermost shape,
   * the one the author wrote, fires the diagnostic.
   *
   * @reference https://typescript-eslint.io/rules/sort-type-constituents
   */
  "typescript/sort-type-constituents"?: TtscLintRuleSetting;

  /**
   * Reject non-boolean values used in a boolean context.
   *
   * Type-aware via the Checker. Fires when the test of an `if`, `while`, `do`,
   * `for`, or ternary, the operand of `!`, or either side of `&&` / `||`
   * carries a type whose flags are not pure boolean. Numbers (`if (count)` is
   * truthy for any non-zero), strings (`""` is falsy), and nullable objects
   * (`if (obj)` conflates `null` / `undefined` with a present object) all
   * silently coerce in boolean position; an explicit comparison (`count !== 0`,
   * `str.length > 0`, `obj != null`) names the intent.
   *
   * @reference https://typescript-eslint.io/rules/strict-boolean-expressions
   */
  "typescript/strict-boolean-expressions"?: TtscLintRuleSetting;

  /**
   * Require every enumerable member of a discriminant to be covered by an
   * explicit `case`.
   *
   * Type-aware via the Checker. Singleton literals, literal unions, enums,
   * nullish members, bigint and boolean literals, unique symbols, constrained
   * generics, and literal pieces of intersections are enumerable. Open
   * primitive pieces remain unenumerated without hiding adjacent finite
   * members. Under the default options, a `default` clause does not replace
   * explicit finite-member coverage.
   *
   * @reference https://typescript-eslint.io/rules/switch-exhaustiveness-check
   */
  "typescript/switch-exhaustiveness-check"?: TtscLintRuleOptionsSetting<ITtscLintTypeScriptSwitchExhaustivenessCheckRuleOptions>;

  /**
   * Reject `/// <reference path="..." />`, `/// <reference types="" />`, and
   * `/// <reference lib="" />` directives.
   *
   * Replace with `import` (or `import type`) declarations and
   * `compilerOptions.types` in `tsconfig.json`.
   *
   * @reference https://typescript-eslint.io/rules/triple-slash-reference
   */
  "typescript/triple-slash-reference"?: TtscLintRuleSetting;

  /**
   * Reject referencing a class instance method as a value instead of calling it
   * (`obj.method` passed as a callback, aliased to a variable, or stored on
   * another object).
   *
   * Type-aware via the Checker. JavaScript methods are not bound to their
   * receiver — once extracted, `this` resolves to whatever the caller supplies
   * (usually `undefined` in strict mode or the host object the value lands on).
   * Safe positions — immediate call (`obj.method()`), assignment target,
   * `typeof` / `delete` operand, `instanceof` / `in` operand, and
   * tagged-template tag — pass through; static methods are exempt because the
   * constructor is stably bound.
   *
   * @reference https://typescript-eslint.io/rules/unbound-method
   */
  "typescript/unbound-method"?: TtscLintRuleSetting;

  /**
   * Require the callback parameter of `.catch(...)` and the second argument of
   * `.then(...)` to be typed `unknown`.
   *
   * Mirrors TypeScript 4.4+ `useUnknownInCatchVariables`, which made `catch
   * (e)` default to `unknown` — the same discipline applied to promise
   * rejection handlers so a rejection cannot smuggle in an implicit `any`.
   *
   * @reference https://typescript-eslint.io/rules/use-unknown-in-catch-callback-variable
   */
  "typescript/use-unknown-in-catch-callback-variable"?: TtscLintRuleSetting;
}
