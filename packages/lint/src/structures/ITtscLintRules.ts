import type {
  ITtscLintJsdocRuleOptions,
  ITtscLintPrintWidthRuleOptions,
  ITtscLintQuotesRuleOptions,
  ITtscLintSemiRuleOptions,
  ITtscLintSortImportsRuleOptions,
  ITtscLintTrailingCommaRuleOptions,
} from "./TtscLintRuleOptions";
import type { TtscLintSeverity } from "./TtscLintSeverity";

/** Severity-only rule setting. */
export type TtscLintRuleSetting =
  | TtscLintSeverity
  | readonly [TtscLintSeverity];

/** Rule setting that accepts a typed options object in tuple form. */
export type TtscLintRuleOptionsSetting<TOptions> =
  | TtscLintRuleSetting
  | readonly [TtscLintSeverity, TOptions];

/**
 * Rule severity map accepted by `ITtscLintConfig.rules`.
 *
 * Built-in rules are listed as concrete optional properties so TypeScript can
 * autocomplete rule names and reject typos. Built-in rule names intentionally
 * mirror ESLint-style kebab-case IDs; contributor rules keep their namespace
 * with a slash, for example `demo/no-demo`.
 */
export interface ITtscLintRules {
  /** keeps overload declarations for the same member adjacent. */
  "adjacent-overload-signatures"?: TtscLintRuleSetting;

  /** prefers `T[]` and `readonly T[]` over array helper types. */
  "array-type"?: TtscLintRuleSetting;

  /** Reject `await` on non-thenable operands. **Type-aware** — uses the Checker. Autofixable (drops the `await`). */
  "await-thenable"?: TtscLintRuleSetting;

  /** rejects TypeScript suppression comments such as `@ts-ignore`. */
  "ban-ts-comment"?: TtscLintRuleSetting;

  /** rejects obsolete `tslint:` comments. */
  "ban-tslint-comment"?: TtscLintRuleSetting;

  /** prefers `Record` for single index-signature object types. */
  "consistent-indexed-object-style"?: TtscLintRuleSetting;

  /** prefers `as` type assertions over angle-bracket assertions. */
  "consistent-type-assertions"?: TtscLintRuleSetting;

  /** prefers interfaces for object-shaped type definitions. */
  "consistent-type-definitions"?: TtscLintRuleSetting;

  /** Prefer `import type {}` when imports are types-only. */
  "consistent-type-imports"?: TtscLintRuleSetting;

  /** `(req, opt = 1, req2)` → fail. */
  "default-param-last"?: TtscLintRuleSetting;

  /** prefers dot property access when a string-literal key is a valid identifier. */
  "dot-notation"?: TtscLintRuleSetting;

  /** requires strict equality operators. */
  eqeqeq?: TtscLintRuleSetting;

  /** `for (i = 0; i < 10; i--)` → fail. */
  "for-direction"?: TtscLintRuleSetting;

  /** prefers function-property signatures over method shorthand signatures. */
  "method-signature-style"?: TtscLintRuleSetting;

  /** rejects `alert`, `confirm`, and `prompt`. */
  "no-alert"?: TtscLintRuleSetting;

  /** rejects `Array` constructor calls. */
  "no-array-constructor"?: TtscLintRuleSetting;

  /** rejects `delete` on array elements. */
  "no-array-delete"?: TtscLintRuleSetting;

  /** Reject `new Promise(async (...) => ...)`. */
  "no-async-promise-executor"?: TtscLintRuleSetting;

  /** rejects bitwise operators. */
  "no-bitwise"?: TtscLintRuleSetting;

  /** rejects `arguments.caller` and `arguments.callee`. */
  "no-caller"?: TtscLintRuleSetting;

  /** rejects lexical declarations directly inside `case` clauses. */
  "no-case-declarations"?: TtscLintRuleSetting;

  /** rejects reassignment of class declarations. */
  "no-class-assign"?: TtscLintRuleSetting;

  /** rejects comparisons against `-0`. */
  "no-compare-neg-zero"?: TtscLintRuleSetting;

  /** rejects assignments inside conditions. */
  "no-cond-assign"?: TtscLintRuleSetting;

  /** rejects confusing non-null assertions next to equality checks. */
  "no-confusing-non-null-assertion"?: TtscLintRuleSetting;

  /** rejects `console` calls. */
  "no-console"?: TtscLintRuleSetting;

  /** Reject `while (true)` and other constant test expressions. */
  "no-constant-condition"?: TtscLintRuleSetting;

  /** rejects `continue` statements. */
  "no-continue"?: TtscLintRuleSetting;

  /** rejects control characters in regular expressions. */
  "no-control-regex"?: TtscLintRuleSetting;

  /** Reject `debugger`. */
  "no-debugger"?: TtscLintRuleSetting;

  /** rejects deleting variables. */
  "no-delete-var"?: TtscLintRuleSetting;

  /** Function declared with two parameters of the same name. */
  "no-dupe-args"?: TtscLintRuleSetting;

  /** `if (a) ... else if (a) ...`. */
  "no-dupe-else-if"?: TtscLintRuleSetting;

  /** `{ a: 1, a: 2 }`. */
  "no-dupe-keys"?: TtscLintRuleSetting;

  /** Same case label twice in a `switch`. */
  "no-duplicate-case"?: TtscLintRuleSetting;

  /** rejects duplicate enum member values. */
  "no-duplicate-enum-values"?: TtscLintRuleSetting;

  /** rejects `delete` on dynamically computed property keys. */
  "no-dynamic-delete"?: TtscLintRuleSetting;

  /** Reject `if (x) {}`, `while (x) {}`, etc. */
  "no-empty"?: TtscLintRuleSetting;

  /** rejects empty regex character classes. */
  "no-empty-character-class"?: TtscLintRuleSetting;

  /** Reject `function f() {}`. */
  "no-empty-function"?: TtscLintRuleSetting;

  /** rejects empty interfaces. */
  "no-empty-interface"?: TtscLintRuleSetting;

  /** rejects empty object type literals. */
  "no-empty-object-type"?: TtscLintRuleSetting;

  /** rejects empty destructuring patterns. */
  "no-empty-pattern"?: TtscLintRuleSetting;

  /** rejects empty class static blocks. */
  "no-empty-static-block"?: TtscLintRuleSetting;

  /** rejects loose null comparisons. */
  "no-eq-null"?: TtscLintRuleSetting;

  /** rejects `eval`. */
  "no-eval"?: TtscLintRuleSetting;

  /** rejects reassignment of caught exceptions. */
  "no-ex-assign"?: TtscLintRuleSetting;

  /** Reject `any` annotations. Typically `"warning"` during migrations. */
  "no-explicit-any"?: TtscLintRuleSetting;

  /** rejects unnecessary `.bind()` calls. */
  "no-extra-bind"?: TtscLintRuleSetting;

  /** rejects redundant boolean casts. */
  "no-extra-boolean-cast"?: TtscLintRuleSetting;

  /** Reject `x!!`. Autofixable. */
  "no-extra-non-null-assertion"?: TtscLintRuleSetting;

  /** Reject `switch` case fall-through without an explicit comment. */
  "no-fallthrough"?: TtscLintRuleSetting;

  /** rejects reassignment of function declarations. */
  "no-func-assign"?: TtscLintRuleSetting;

  /** Hoist inline `type` modifiers into a single `import type {}`. Autofixable. */
  "no-import-type-side-effects"?: TtscLintRuleSetting;

  /** rejects type annotations TypeScript can infer. */
  "no-inferrable-types"?: TtscLintRuleSetting;

  /** rejects function declarations nested in blocks. */
  "no-inner-declarations"?: TtscLintRuleSetting;

  /** rejects irregular whitespace. */
  "no-irregular-whitespace"?: TtscLintRuleSetting;

  /** rejects `__iterator__`. */
  "no-iterator"?: TtscLintRuleSetting;

  /** rejects labels. */
  "no-labels"?: TtscLintRuleSetting;

  /** rejects unnecessary standalone blocks. */
  "no-lone-blocks"?: TtscLintRuleSetting;

  /** rejects `if` as the only statement in an `else`. */
  "no-lonely-if"?: TtscLintRuleSetting;

  /** Reject decimal integer literals whose source text cannot round-trip as a JavaScript Number, including overflow-scale values. */
  "no-loss-of-precision"?: TtscLintRuleSetting;

  /** rejects misleading regex character classes. */
  "no-misleading-character-class"?: TtscLintRuleSetting;

  /** rejects constructor-like signatures in interfaces. */
  "no-misused-new"?: TtscLintRuleSetting;

  /** rejects enums that mix numeric and string members. */
  "no-mixed-enums"?: TtscLintRuleSetting;

  /** Reject `a = b = 0` chains. */
  "no-multi-assign"?: TtscLintRuleSetting;

  /** rejects multiline string escapes. */
  "no-multi-str"?: TtscLintRuleSetting;

  /** rejects non-ambient namespaces. */
  "no-namespace"?: TtscLintRuleSetting;

  /** rejects negated conditions with an `else`. */
  "no-negated-condition"?: TtscLintRuleSetting;

  /** rejects nested ternary expressions. */
  "no-nested-ternary"?: TtscLintRuleSetting;

  /** rejects `new` expressions used only for side effects. */
  "no-new"?: TtscLintRuleSetting;

  /** rejects `Function` constructors. */
  "no-new-func"?: TtscLintRuleSetting;

  /** rejects primitive wrapper constructors. */
  "no-new-wrappers"?: TtscLintRuleSetting;

  /** rejects non-null assertions next to `??`. */
  "no-non-null-asserted-nullish-coalescing"?: TtscLintRuleSetting;

  /** rejects non-null assertions on optional chains. */
  "no-non-null-asserted-optional-chain"?: TtscLintRuleSetting;

  /** rejects postfix non-null assertions. */
  "no-non-null-assertion"?: TtscLintRuleSetting;

  /** rejects calling global objects as functions. */
  "no-obj-calls"?: TtscLintRuleSetting;

  /** rejects `new Object()`. */
  "no-object-constructor"?: TtscLintRuleSetting;

  /** Reject octal literals. */
  "no-octal"?: TtscLintRuleSetting;

  /** Reject `\08`-style escapes. */
  "no-octal-escape"?: TtscLintRuleSetting;

  /** rejects `++` and `--`. */
  "no-plusplus"?: TtscLintRuleSetting;

  /** Reject `return` inside a Promise executor. */
  "no-promise-executor-return"?: TtscLintRuleSetting;

  /** Reject `obj.__proto__`. */
  "no-proto"?: TtscLintRuleSetting;

  /** Reject `obj.hasOwnProperty(...)`; use `Object.prototype.hasOwnProperty.call`. */
  "no-prototype-builtins"?: TtscLintRuleSetting;

  /** rejects repeated literal spaces in regexes. */
  "no-regex-spaces"?: TtscLintRuleSetting;

  /** Reject `require(...)` outside CommonJS modules. */
  "no-require-imports"?: TtscLintRuleSetting;

  /** rejects assignments in `return`. */
  "no-return-assign"?: TtscLintRuleSetting;

  /** rejects `javascript:` URLs. */
  "no-script-url"?: TtscLintRuleSetting;

  /** Reject `x = x`, including destructured forms. */
  "no-self-assign"?: TtscLintRuleSetting;

  /** Reject `x === x` and friends. */
  "no-self-compare"?: TtscLintRuleSetting;

  /** rejects comma expressions. */
  "no-sequences"?: TtscLintRuleSetting;

  /** rejects returned values from setters. */
  "no-setter-return"?: TtscLintRuleSetting;

  /** rejects shadowing restricted globals. */
  "no-shadow-restricted-names"?: TtscLintRuleSetting;

  /** rejects sparse arrays. */
  "no-sparse-arrays"?: TtscLintRuleSetting;

  /** Reject `${}` inside non-template strings (probably a bug). */
  "no-template-curly-in-string"?: TtscLintRuleSetting;

  /** rejects aliasing `this` to locals. */
  "no-this-alias"?: TtscLintRuleSetting;

  /** `throw "boom"` → fail. Use `throw new Error(...)`. */
  "no-throw-literal"?: TtscLintRuleSetting;

  /** rejects initializing to `undefined`. */
  "no-undef-init"?: TtscLintRuleSetting;

  /** rejects constructor assignments already handled by parameter properties. */
  "no-unnecessary-parameter-property-assignment"?: TtscLintRuleSetting;

  /** rejects the global `undefined` identifier. */
  "no-undefined"?: TtscLintRuleSetting;

  /** Reject `<T extends unknown>` and similar. Autofixable. */
  "no-unnecessary-type-constraint"?: TtscLintRuleSetting;

  /** rejects redundant ternary expressions. */
  "no-unneeded-ternary"?: TtscLintRuleSetting;

  /** rejects unsafe class/interface declaration merging. */
  "no-unsafe-declaration-merging"?: TtscLintRuleSetting;

  /** Reject `return` / `throw` inside a `finally`. */
  "no-unsafe-finally"?: TtscLintRuleSetting;

  /** rejects the unsafe `Function` type. */
  "no-unsafe-function-type"?: TtscLintRuleSetting;

  /** rejects unsafe negation before relational checks. */
  "no-unsafe-negation"?: TtscLintRuleSetting;

  /** rejects expression statements with no effect. */
  "no-unused-expressions"?: TtscLintRuleSetting;

  /** rejects labels that no `break` or `continue` targets. */
  "no-unused-labels"?: TtscLintRuleSetting;

  /** rejects unnecessary `.call()` and `.apply()`. */
  "no-useless-call"?: TtscLintRuleSetting;

  /** rejects catch blocks that only rethrow. */
  "no-useless-catch"?: TtscLintRuleSetting;

  /** rejects unnecessary computed property keys. */
  "no-useless-computed-key"?: TtscLintRuleSetting;

  /** rejects unnecessary string concatenation. */
  "no-useless-concat"?: TtscLintRuleSetting;

  /** rejects empty constructors with no parameters. */
  "no-useless-constructor"?: TtscLintRuleSetting;

  /** rejects redundant empty `export {}` declarations in module files. */
  "no-useless-empty-export"?: TtscLintRuleSetting;

  /** Reject `\.` and friends when not required. Autofixable. */
  "no-useless-escape"?: TtscLintRuleSetting;

  /** Reject `{ x: x }` in destructuring. Autofixable. */
  "no-useless-rename"?: TtscLintRuleSetting;

  /** Reject `var`. Use `let` or `const`. Autofixable. */
  "no-var"?: TtscLintRuleSetting;

  /** Reject `with (...)`. */
  "no-with"?: TtscLintRuleSetting;

  /** Reject `String` / `Number` / `Boolean` / `Symbol` / `BigInt`. Autofixable. `Object` stays detection-only. */
  "no-wrapper-object-types"?: TtscLintRuleSetting;

  /** Reject `{ foo: foo }`. Autofixable. */
  "object-shorthand"?: TtscLintRuleSetting;

  /** prefers compound assignment operators. */
  "operator-assignment"?: TtscLintRuleSetting;

  /** Reject `as Literal` when `as const` would do. Autofixable. */
  "prefer-as-const"?: TtscLintRuleSetting;

  /** When a `let` is never reassigned, demand `const`. Autofixable for single declarations. */
  "prefer-const"?: TtscLintRuleSetting;

  /** requires explicit enum member initializers. */
  "prefer-enum-initializers"?: TtscLintRuleSetting;

  /** prefers `**` over `Math.pow`. */
  "prefer-exponentiation-operator"?: TtscLintRuleSetting;

  /** Prefer `for..of` when the index is unused. */
  "prefer-for-of"?: TtscLintRuleSetting;

  /** prefers function type aliases over single-call interfaces. */
  "prefer-function-type"?: TtscLintRuleSetting;

  /** prefers literal enum member initializers over computed expressions. */
  "prefer-literal-enum-member"?: TtscLintRuleSetting;

  /** Use `namespace` not `module`. Autofixable. */
  "prefer-namespace-keyword"?: TtscLintRuleSetting;

  /** prefers spread arguments over `.apply`. */
  "prefer-spread"?: TtscLintRuleSetting;

  /** prefers template literals over string concatenation. */
  "prefer-template"?: TtscLintRuleSetting;

  /** requires a radix argument for `parseInt`. */
  radix?: TtscLintRuleSetting;

  /** requires generator functions to contain `yield`. */
  "require-yield"?: TtscLintRuleSetting;

  /** rejects triple-slash reference directives. */
  "triple-slash-reference"?: TtscLintRuleSetting;

  /** requires `Number.isNaN`/`isNaN` for `NaN` checks. */
  "use-isnan"?: TtscLintRuleSetting;

  /** restricts `typeof` comparisons to valid strings. */
  "valid-typeof"?: TtscLintRuleSetting;

  /** requires `var` declarations at the top of their scope. */
  "vars-on-top"?: TtscLintRuleSetting;

  /** rejects literal-first comparisons. */
  yoda?: TtscLintRuleSetting;

  /** Insert or remove trailing semicolons on ASI-terminated statements. */
  "format/semi"?: TtscLintRuleOptionsSetting<ITtscLintSemiRuleOptions>;

  /** Convert quoted string literals to the configured quote style. */
  "format/quotes"?: TtscLintRuleOptionsSetting<ITtscLintQuotesRuleOptions>;

  /** Add or remove trailing commas in multi-line lists. */
  "format/trailing-comma"?: TtscLintRuleOptionsSetting<ITtscLintTrailingCommaRuleOptions>;

  /** Reorder and group import declarations. */
  "format/sort-imports"?: TtscLintRuleOptionsSetting<ITtscLintSortImportsRuleOptions>;

  /** Normalize JSDoc spacing, tag names, and tag layout. */
  "format/jsdoc"?: TtscLintRuleOptionsSetting<ITtscLintJsdocRuleOptions>;

  /** Reflow supported list-shaped syntax when its flat form exceeds print width. */
  "format/print-width"?: TtscLintRuleOptionsSetting<ITtscLintPrintWidthRuleOptions>;

  /** Contributor plugin rules keyed by namespace, for example `demo/no-demo`. */
  [ruleName: `${string}/${string}`]:
    | TtscLintRuleSetting
    | readonly [TtscLintSeverity, unknown]
    | undefined;
}
