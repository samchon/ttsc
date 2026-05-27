# `@ttsc/lint`

![banner of @ttsc/lint](https://ttsc.dev/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE)
[![NPM Version](https://img.shields.io/npm/v/@ttsc/lint.svg)](https://www.npmjs.com/package/@ttsc/lint)
[![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/lint.svg)](https://www.npmjs.com/package/@ttsc/lint)
[![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest)
[![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs)
[![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

A linter and formatter. Co-protagonist of the [`ttsc`](https://ttsc.dev) toolchain — paired with `ttsc`, it replaces `eslint` and `prettier`.

470+ rules. Lint violations surface as `error TSxxxxx` from a single compile pass; the formatter applies via `ttsc format`.

## Demonstration

Given this file:

```typescript
// src/index.ts
var x: number = 3;
let y: number = 4;
const z: string = 5;

console.log(x + y + z);
```

Run `ttsc` with `@ttsc/lint` enabled (see [Setup](#setup)):

```bash
$ pnpm ttsc
src/index.ts:3:7 - error TS2322: Type 'number' is not assignable to type 'string'.

3 const z: string = 5;
        ~

src/index.ts:2:5 - error TS17397: [prefer-const] Use const instead of let.

2 let y: number = 4;
      ~~~~~~~~~~~~~

src/index.ts:1:1 - error TS11966: [no-var] Unexpected var, use let or const instead.

1 var x: number = 3;
  ~~~~~~~~~~~~~~~~~~

Found 3 errors in the same file, starting at: src/index.ts:3
```

Type errors (`TS2322`) and lint violations (`TS17397`, `TS11966`) come out together. No second tool, no second CI step.

## Setup

```bash
npm install -D ttsc @ttsc/lint @typescript/native-preview
```

Drop a `lint.config.ts` next to your `tsconfig.json`:

```ts
// lint.config.ts
import type { ITtscLintConfig } from "@ttsc/lint";

export default {
  format: {
    printWidth: 100,
    singleQuote: true,
    trailingComma: "all",
  },
  rules: {
    "no-var": "error",
    "prefer-const": "error",
    "typescript/no-explicit-any": "warning",
    "no-console": "off",
  },
} satisfies ITtscLintConfig;
```

Run your normal `ttsc` or `ttsx`:

```bash
npx ttsc
npx ttsx src/index.ts
```

Errors fail the command; warnings print without affecting the exit code. Under `ttsx`, errors stop the program before your entrypoint runs.

`ttsc fix` applies every autofix the enabled rules offer — lint and format together — writes results back to disk, then re-runs type-check + lint. `ttsc format` runs the format rule set through the same dataflow.

```bash
npx ttsc fix
npx ttsc format
```

`ttsc fix` is a one-shot project pass and rejects `--watch`, single-file mode, and `--emit`. Fixes are written to disk before the recheck runs, so source stays modified even when the command exits non-zero on remaining errors. Recommended flow: run `ttsc fix` locally, commit, then have CI run `ttsc --noEmit` to gate on zero remaining errors.

## Format

Configure the formatter through the `format` block in `lint.config.ts`. Keys mirror `.prettierrc`; the presence of the block — even empty `format: {}` — enables the always-on format rules at Prettier defaults so `ttsc format` rewrites your source to match.

```ts
// lint.config.ts
import type { ITtscLintConfig } from "@ttsc/lint";

export default {
  format: {
    printWidth: 100,
    singleQuote: true,
    trailingComma: "all",
    importOrder: ["<THIRD_PARTY_MODULES>", "@api(.*)$", "^[./]"],
    jsdoc: true,
  },
  rules: { "no-var": "error" },
} satisfies ITtscLintConfig;
```

`ttsc check` does **not** fail on formatting by default — it surfaces format diagnostics only when you opt in with `format.severity`. `ttsc format` runs the active format rules across the project and writes results to disk regardless of `severity`.

Each `format` config key activates one rule:

| Config key | Rule | Effect |
| --- | --- | --- |
| `severity` (default `"off"`) | applies to every format rule | Sets the check-time diagnostic level. Does not gate `ttsc format` — that runs all active rules. |
| `semi` | `format/semi` | Insert trailing semicolons on ASI-terminated statements. |
| `singleQuote` | `format/quotes` | Convert quoted strings to the preferred quote style. |
| `trailingComma` | `format/trailing-comma` | Add trailing commas to multi-line lists. |
| `printWidth`, `tabWidth`, `useTabs`, `endOfLine` | `format/print-width` | Column-aware line reflow. Object/array literals, call/new arguments, and named import/export clauses break across lines when their flat form overflows the budget. |
| `importOrder` (opt-in) | `format/sort-imports` | Group external/relative imports and alphabetize each group + its specifiers. |
| `jsdoc` (opt-in) | `format/jsdoc` | Normalize JSDoc blocks toward [prettier-plugin-jsdoc](https://github.com/hosseinmd/prettier-plugin-jsdoc). |

`format/sort-imports` and `format/jsdoc` are **opt-in** — they only activate when you set `importOrder` or `jsdoc`. Every other format rule turns on automatically as soon as the `format` block is present.

To override a single format rule, drop a sibling `rules` entry — `rules` wins on conflict:

```ts
export default {
  format: { severity: "warning", semi: true },
  rules: { "format/semi": "off" }, // overrides format.semi for this one rule
} satisfies ITtscLintConfig;
```

## Rules

Lint rules are off until you enable them in `lint.config.ts`. Severity values: `"error"` fails the build, `"warning"` prints without affecting the exit code, `"off"` disables the rule.

```ts
// lint.config.ts
export default {
  rules: {
    "no-var": "error",
    "eqeqeq": "error",
    "prefer-template": "warning",
    "typescript/no-non-null-assertion": "off",
  },
} satisfies ITtscLintConfig;
```

Rule IDs use ESLint-style kebab-case and slash namespaces — `no-var`, `react/jsx-key`, `testing-library/prefer-screen-queries`. The exported `ITtscLintRules` type is the intersection of family-specific interfaces such as `ITtscLintCoreRules`, `ITtscLintTypeScriptRules`, `ITtscLintReactRules`, and `ITtscLintVitestRules`, so users can type a whole config or a narrower family-shaped object.

Most rule corpus cases live in `tests/test-lint/src/cases/*.ts`; source-path and engine-focused families with package-local Go coverage, such as `boundaries/*` and `security/*`, link to their Go tests. Each rule below links to its tested fixture where one exists.

### ESLint core

Generic ESLint-compatible rules that apply to both JavaScript and TypeScript source. Every rule listed here corresponds 1-to-1 with an ESLint core rule of the same kebab-case id, so projects migrating from ESLint can paste their rule severities into `lint.config.ts` without renaming anything. TypeScript-only rules and `@typescript-eslint` extensions live under `typescript/*` in [TypeScript](#typescript) — `@ttsc/lint` does not accept legacy bare names or `@typescript-eslint/*` aliases for those.

Source: [ESLint core rules](https://eslint.org/docs/latest/rules/).

- [`default-param-last`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/default-param-last.ts): keeps parameters with default values at the end of the list.
- [`dot-notation`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/dot-notation.ts): prefers dot property access when a string-literal key is a valid identifier.
- [`eqeqeq`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/eqeqeq.ts): requires strict equality operators.
- [`for-direction`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/for-direction.ts): catches loop counters updated in the wrong direction.
- [`getter-return`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/getter-return.ts): require a `get` accessor's body to return a value on every reachable exit.
- [`no-alert`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-alert.ts): rejects `alert`, `confirm`, and `prompt`.
- [`no-array-constructor`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-array-constructor.ts): rejects `Array` constructor calls.
- [`no-async-promise-executor`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-async-promise-executor.ts): rejects async Promise executors.
- [`no-await-in-loop`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-await-in-loop.ts): reject `await` expressions evaluated inside a loop body.
- [`no-bitwise`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-bitwise.ts): rejects bitwise operators.
- [`no-caller`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-caller.ts): rejects `arguments.caller` and `arguments.callee`.
- [`no-case-declarations`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-case-declarations.ts): rejects lexical declarations directly inside `case` clauses.
- [`no-class-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-class-assign.ts): rejects reassignment of class declarations.
- [`no-compare-neg-zero`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-compare-neg-zero.ts): rejects comparisons against `-0`.
- [`no-cond-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-cond-assign.ts): rejects assignments inside conditions.
- [`no-console`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-console.ts): rejects `console` calls.
- [`no-constant-condition`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-constant-condition.ts): rejects constant conditions.
- [`no-constructor-return`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-constructor-return.ts): reject `return X;` (with a value) inside a class constructor.
- [`no-continue`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-continue.ts): rejects `continue` statements.
- [`no-control-regex`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-control-regex.ts): rejects control characters in regular expressions.
- [`no-debugger`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-debugger.ts): rejects `debugger` statements.
- [`no-delete-var`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-delete-var.ts): rejects deleting variables.
- [`no-dupe-args`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-dupe-args.ts): rejects duplicate function parameters.
- [`no-dupe-class-members`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-dupe-class-members.ts): reject two declarations of the same member on a single class.
- [`no-dupe-else-if`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-dupe-else-if.ts): rejects repeated `else if` conditions.
- [`no-dupe-keys`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-dupe-keys.ts): rejects duplicate object keys.
- [`no-duplicate-case`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-duplicate-case.ts): rejects duplicate `switch` case labels.
- [`no-duplicate-imports`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-duplicate-imports.ts): reject two import declarations that resolve to the same module specifier.
- [`no-empty`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty.ts): rejects empty blocks.
- [`no-empty-character-class`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-character-class.ts): rejects empty regex character classes.
- [`no-empty-function`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-function.ts): rejects empty functions.
- [`no-empty-pattern`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-pattern.ts): rejects empty destructuring patterns.
- [`no-empty-static-block`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-static-block.ts): rejects empty class static blocks.
- [`no-eq-null`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-eq-null.ts): rejects loose null comparisons.
- [`no-eval`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-eval.ts): rejects `eval`.
- [`no-ex-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-ex-assign.ts): rejects reassignment of caught exceptions.
- [`no-extend-native`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-extend-native.ts): reject assignments to a built-in prototype such as `Array.prototype.foo = bar`.
- [`no-extra-bind`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-extra-bind.ts): rejects unnecessary `.bind()` calls.
- [`no-extra-boolean-cast`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-extra-boolean-cast.ts): rejects redundant boolean casts.
- [`no-fallthrough`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-fallthrough.ts): rejects unmarked `switch` fallthrough.
- [`no-func-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-func-assign.ts): rejects reassignment of function declarations.
- [`no-implicit-coercion`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-implicit-coercion.ts): reject common implicit-coercion idioms (`!!x`, `+x`, `"" + x`) in favor of the explicit `Boolean(x)` / `Number(x)` / `String(x)` conversions.
- [`no-import-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-import-assign.ts): rejects writes to imported bindings (including `ns.x = ...` for namespace imports).
- [`no-inner-declarations`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-inner-declarations.ts): rejects function declarations nested in blocks.
- [`no-irregular-whitespace`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-irregular-whitespace.ts): rejects irregular whitespace.
- [`no-iterator`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-iterator.ts): rejects `__iterator__`.
- [`no-labels`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-labels.ts): rejects labels.
- [`no-lone-blocks`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-lone-blocks.ts): rejects unnecessary standalone blocks.
- [`no-lonely-if`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-lonely-if.ts): rejects `if` as the only statement in an `else`.
- [`no-loop-func`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-loop-func.ts): reject function declarations defined inside the body of a loop.
- [`no-loss-of-precision`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-loss-of-precision.ts): rejects number literals that lose precision.
- [`no-misleading-character-class`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-misleading-character-class.ts): rejects misleading regex character classes.
- [`no-mixed-operators`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-mixed-operators.ts): reject mixing operators of different precedence families in the same expression without explicit parentheses around the inner sub-expression.
- [`no-multi-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-multi-assign.ts): rejects chained assignments.
- [`no-multi-str`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-multi-str.ts): rejects multiline string escapes.
- [`no-negated-condition`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-negated-condition.ts): rejects negated conditions with an `else`.
- [`no-nested-ternary`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-nested-ternary.ts): rejects nested ternary expressions.
- [`no-new`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-new.ts): rejects `new` expressions used only for side effects.
- [`no-new-func`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-new-func.ts): rejects `Function` constructors.
- [`no-new-symbol`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-new-symbol.ts): reject `new Symbol(...)`.
- [`no-new-wrappers`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-new-wrappers.ts): rejects primitive wrapper constructors.
- [`no-obj-calls`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-obj-calls.ts): rejects calling global objects as functions.
- [`no-object-constructor`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-object-constructor.ts): rejects `new Object()`.
- [`no-octal`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-octal.ts): rejects legacy octal literals.
- [`no-octal-escape`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-octal-escape.ts): rejects octal escape sequences.
- [`no-param-reassign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-param-reassign.ts): reject reassigning a function parameter inside the body of the function it belongs to.
- [`no-plusplus`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-plusplus.ts): rejects `++` and `--`.
- [`no-promise-executor-return`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-promise-executor-return.ts): rejects returned values from Promise executors.
- [`no-proto`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-proto.ts): rejects `__proto__`.
- [`no-prototype-builtins`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-prototype-builtins.ts): rejects direct `Object.prototype` method calls.
- [`no-redeclare`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-redeclare.ts): rejects redeclaring a binding in the same scope.
- [`no-regex-spaces`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-regex-spaces.ts): rejects repeated literal spaces in regexes.
- [`no-return-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-return-assign.ts): rejects assignments in `return`.
- [`no-script-url`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-script-url.ts): rejects `javascript:` URLs.
- [`no-self-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-self-assign.ts): rejects assignments to the same value.
- [`no-self-compare`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-self-compare.ts): rejects comparing a value to itself.
- [`no-sequences`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-sequences.ts): rejects comma expressions.
- [`no-setter-return`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-setter-return.ts): rejects returned values from setters.
- [`no-shadow-restricted-names`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-shadow-restricted-names.ts): rejects shadowing restricted globals.
- [`no-sparse-arrays`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-sparse-arrays.ts): rejects sparse arrays.
- [`no-template-curly-in-string`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-template-curly-in-string.ts): rejects `${...}` text inside normal strings.
- [`no-this-before-super`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-this-before-super.ts): reject `this` (or `super.x`) references that precede the first `super()` call in a derived constructor.
- [`no-throw-literal`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-throw-literal.ts): rejects throwing literals.
- [`no-undef-init`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-undef-init.ts): rejects initializing to `undefined`.
- [`no-undefined`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-undefined.ts): rejects the global `undefined` identifier.
- [`no-unneeded-ternary`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unneeded-ternary.ts): rejects redundant ternary expressions.
- [`no-unreachable`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unreachable.ts): reject statements that follow an unconditional `return`, `throw`, `break`, or `continue` in the same block — control flow has already left the block, so any later statement is dead code.
- [`no-unsafe-finally`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unsafe-finally.ts): rejects control flow from `finally`.
- [`no-unsafe-negation`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unsafe-negation.ts): rejects unsafe negation before relational checks.
- [`no-unsafe-optional-chaining`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unsafe-optional-chaining.ts): reject member access or call expressions that chain off an optional chain without continuing the chain.
- [`no-unused-expressions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unused-expressions.ts): rejects expression statements with no effect.
- [`no-unused-labels`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unused-labels.ts): rejects labels that no `break` or `continue` targets.
- [`no-useless-assignment`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-assignment.ts): reject an assignment whose value is immediately overwritten by the very next statement without an intervening read of the same identifier.
- [`no-useless-call`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-call.ts): rejects unnecessary `.call()` and `.apply()`.
- [`no-useless-catch`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-catch.ts): rejects catch blocks that only rethrow.
- [`no-useless-computed-key`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-computed-key.ts): rejects unnecessary computed property keys.
- [`no-useless-concat`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-concat.ts): rejects unnecessary string concatenation.
- [`no-useless-constructor`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-constructor.ts): rejects empty constructors with no parameters.
- [`no-useless-escape`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-escape.ts): rejects backslash escapes that have no effect inside strings or regexes.
- [`no-useless-rename`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-rename.ts): rejects import/export/destructure renames to the same name.
- [`no-useless-return`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-return.ts): reject a bare `return;` whose only effect is to end a function body that would have returned anyway.
- [`no-var`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-var.ts): rejects `var`.
- [`no-with`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-with.ts): rejects `with` statements.
- [`object-shorthand`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/object-shorthand.ts): requires object property shorthand where possible.
- [`operator-assignment`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/operator-assignment.ts): prefers compound assignment operators.
- [`prefer-const`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-const.ts): prefers `const` for `let` bindings that are never reassigned.
- [`prefer-exponentiation-operator`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-exponentiation-operator.ts): prefers `**` over `Math.pow`.
- [`prefer-for-of`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-for-of.ts): prefers `for...of` for simple array iteration.
- [`prefer-numeric-literals`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-numeric-literals.ts): prefer ES2015+ numeric literal forms (`0b…`, `0o…`, `0x…`) over `parseInt(string, 2 | 8 | 16)`.
- [`prefer-object-has-own`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-object-has-own.ts): prefer `Object.hasOwn(obj, key)` over `Object.prototype.hasOwnProperty.call(obj, key)`.
- [`prefer-object-spread`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-object-spread.ts): prefer object-spread `{ ...a, ...b }` over `Object.assign({}, a, b)`.
- [`prefer-spread`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-spread.ts): prefers spread arguments over `.apply`.
- [`prefer-template`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-template.ts): prefers template literals over string concatenation.
- [`radix`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/radix.ts): requires a radix argument for `parseInt`.
- [`require-yield`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/require-yield.ts): requires generator functions to contain `yield`.
- [`use-isnan`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/use-isnan.ts): requires `Number.isNaN`/`isNaN` for `NaN` checks.
- [`valid-typeof`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/valid-typeof.ts): restricts `typeof` comparisons to valid strings.
- [`vars-on-top`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/vars-on-top.ts): requires `var` declarations at the top of their scope.
- [`yoda`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/yoda.ts): rejects literal-first comparisons.

### TypeScript

TypeScript-only rules and `@typescript-eslint` plugin equivalents, exposed under the `typescript/*` namespace. Each rule either requires TypeScript syntax (interface, `enum`, `namespace`, `as`, `!`, `import type`, type parameters, declaration merging, parameter properties, triple-slash references) or originates from `@typescript-eslint` as a TS-aware extension that has no counterpart in plain ESLint.

Source: [`typescript-eslint`](https://github.com/typescript-eslint/typescript-eslint).

- [`typescript/adjacent-overload-signatures`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/adjacent-overload-signatures.ts): keeps overload declarations for the same member adjacent.
- [`typescript/array-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/array-type.ts): prefers `T[]` and `readonly T[]` over array helper types.
- [`typescript/await-thenable`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/await-thenable.ts): rejects `await` on a value that is neither a Promise nor a thenable (type-aware).
- [`typescript/ban-ts-comment`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/ban-ts-comment.ts): rejects TypeScript suppression comments such as `@ts-ignore`.
- [`typescript/ban-tslint-comment`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/ban-tslint-comment.ts): rejects obsolete `tslint:` comments.
- [`typescript/class-literal-property-style`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-class-literal-property-style.ts): prefer a `static readonly` field over a `get` accessor whose body is a single `return <literal>;`.
- [`typescript/consistent-generic-constructors`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-consistent-generic-constructors.ts): reject the redundant pattern where a variable is annotated with a generic type AND the same generic arguments are repeated on the constructor: `const m: Map<K, V> = new Map<K, V>()`.
- [`typescript/consistent-indexed-object-style`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/consistent-indexed-object-style.ts): prefers `Record` for single index-signature object types.
- [`typescript/consistent-type-assertions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/consistent-type-assertions.ts): prefers `as` type assertions over angle-bracket assertions.
- [`typescript/consistent-type-definitions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/consistent-type-definitions.ts): prefers interfaces for object-shaped type definitions.
- [`typescript/consistent-type-exports`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-consistent-type-exports.ts): require type-only re-exports to use `export type { ... }` instead of mixing them with value-level re-exports.
- [`typescript/consistent-type-imports`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/consistent-type-imports/violation.ts): uses `import type` when imported names are type-only.
- [`typescript/explicit-function-return-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-explicit-function-return-type.ts): require every exported function and method declaration to carry an explicit return-type annotation.
- [`typescript/explicit-member-accessibility`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-explicit-member-accessibility.ts): require an explicit accessibility modifier (`public`, `private`, or `protected`) on every class member declaration.
- [`typescript/method-signature-style`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/method-signature-style.ts): prefers function-property signatures over method shorthand signatures.
- [`typescript/no-array-delete`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-array-delete.ts): rejects `delete` on array elements.
- [`typescript/no-array-for-each`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-array-for-each.ts): prefer `for ... of` over `Array.prototype.forEach()`.
- [`typescript/no-base-to-string`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-base-to-string.ts): rejects string coercion of values whose `toString` resolves to the default `Object.prototype.toString` (type-aware).
- [`typescript/no-confusing-non-null-assertion`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-confusing-non-null-assertion.ts): rejects confusing non-null assertions next to equality checks.
- [`typescript/no-confusing-void-expression`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-confusing-void-expression.ts): reject `void X` expressions used in any position where the surrounding context expects a value — initializer, call argument, `return` operand, conditional, binary, or ternary subexpression.
- [`typescript/no-deprecated`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-deprecated.ts): reject references to declarations annotated `@deprecated` in their JSDoc, with the deprecation comment surfaced at the reference site (type-aware).
- [`typescript/no-duplicate-enum-values`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-duplicate-enum-values.ts): rejects duplicate enum member values.
- [`typescript/no-dynamic-delete`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-dynamic-delete.ts): rejects `delete` on dynamically computed property keys.
- [`typescript/no-empty-interface`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-interface.ts): rejects empty interfaces.
- [`typescript/no-empty-object-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-object-type.ts): rejects empty object type literals.
- [`typescript/no-explicit-any`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-explicit-any.ts): rejects explicit `any`.
- [`typescript/no-extra-non-null-assertion`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-extra-non-null-assertion.ts): rejects repeated non-null assertions.
- [`typescript/no-extraneous-class`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-extraneous-class.ts): reject classes that exist purely as a namespace for static members or that are entirely empty.
- [`typescript/no-floating-promises`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-floating-promises.ts): reject Promise-typed expressions whose result is discarded — most often a bare `getPromise();` expression statement.
- [`typescript/no-for-in-array`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-for-in-array.ts): reject `for (const k in arr)` where `arr` is statically typed as an array or tuple.
- [`typescript/no-import-type-side-effects`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-import-type-side-effects/violation.ts): hoists inline `type` modifiers into a single `import type` declaration.
- [`typescript/no-inferrable-types`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-inferrable-types.ts): rejects type annotations TypeScript can infer.
- [`typescript/no-invalid-void-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-invalid-void-type.ts): reject `void` used as anything other than a function return type.
- [`typescript/no-misused-new`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-misused-new.ts): rejects constructor-like signatures in interfaces.
- [`typescript/no-misused-promises`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-misused-promises.ts): reject Promise values supplied where a non-Promise was expected.
- [`typescript/no-misused-spread`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-misused-spread.ts): reject spread expressions whose operand is syntactically wrong for the surrounding context.
- [`typescript/no-mixed-enums`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-mixed-enums.ts): rejects enums that mix numeric and string members.
- [`typescript/no-namespace`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-namespace.ts): rejects non-ambient namespaces.
- [`typescript/no-non-null-asserted-nullish-coalescing`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-non-null-asserted-nullish-coalescing.ts): rejects non-null assertions next to `??`.
- [`typescript/no-non-null-asserted-optional-chain`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-non-null-asserted-optional-chain.ts): rejects non-null assertions on optional chains.
- [`typescript/no-non-null-assertion`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-non-null-assertion.ts): rejects postfix non-null assertions.
- [`typescript/no-redundant-type-constituents`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-redundant-type-constituents.ts): reject union and intersection type constituents that the type system absorbs anyway — `string | any` collapses to `any`, `T & never` collapses to `never`, `T & unknown` collapses to `T`, and repeated constituents add nothing.
- [`typescript/no-require-imports`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-require-imports.ts): rejects CommonJS `require` imports.
- [`typescript/no-restricted-types`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-restricted-types.ts): reject specific type-reference names that are almost always a mistake — by default the global wrapper types `Object`, `Function`, `Number`, `String`, and `Boolean`.
- [`typescript/no-this-alias`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-this-alias.ts): rejects aliasing `this` to locals.
- [`typescript/no-unnecessary-boolean-literal-compare`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-unnecessary-boolean-literal-compare.ts): reject direct comparison of a boolean-typed value with `true` / `false` literals — `x === true` is just `x`, `x !== false` is just `x`.
- [`typescript/no-unnecessary-condition`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-unnecessary-condition.ts): reject conditions whose static type proves the runtime truthiness is fixed — `if ({})`, `if (null)`, `while ("")`, `0 && f()` (type-aware).
- [`typescript/no-unnecessary-parameter-property-assignment`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unnecessary-parameter-property-assignment.ts): rejects constructor assignments already handled by parameter properties.
- [`typescript/no-unnecessary-template-expression`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-unnecessary-template-expression.ts): reject template literals that collapse to a regular string — `` `${"abc"}` ``, `` `${name}` `` around a string-typed value, or a plain `` `abc` `` with no escaped backticks (type-aware).
- [`typescript/no-unnecessary-type-assertion`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-unnecessary-type-assertion.ts): reject `x as T`, `<T>x`, and `x!` assertions whose target type is the same as `x`'s already-known static type — the assertion adds nothing (type-aware).
- [`typescript/no-unnecessary-type-constraint`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unnecessary-type-constraint.ts): rejects redundant `extends any` and `extends unknown` constraints.
- [`typescript/no-unsafe-declaration-merging`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unsafe-declaration-merging.ts): rejects unsafe class/interface declaration merging.
- [`typescript/no-unsafe-function-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unsafe-function-type.ts): rejects the unsafe `Function` type.
- [`typescript/no-useless-empty-export`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-empty-export.ts): rejects redundant empty `export {}` declarations in module files.
- [`typescript/no-wrapper-object-types`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-wrapper-object-types.ts): rejects boxed object type names such as `String` and `Boolean`.
- [`typescript/non-nullable-type-assertion-style`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/non-nullable-type-assertion-style.ts): reject `x as Foo` assertions whose target type is the non-nullable version of `x`'s static type — replace with the shorter `x!` non-null assertion.
- [`typescript/only-throw-error`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/only-throw-error.ts): reject `throw X` where `X` is statically known not to derive from `Error` — string literals, numbers, plain object literals, and the like.
- [`typescript/prefer-as-const`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-as-const.ts): prefers `as const` for literal assertions.
- [`typescript/prefer-enum-initializers`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-enum-initializers.ts): requires explicit enum member initializers.
- [`typescript/prefer-function-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-function-type.ts): prefers function type aliases over single-call interfaces.
- [`typescript/prefer-includes`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-prefer-includes.ts): prefer `array.includes(x)` over `array.indexOf(x) !== -1` (and the matching `=== -1`, `>= 0`, `< 0`, `> -1` shapes) on array, tuple, and string receivers (type-aware).
- [`typescript/prefer-literal-enum-member`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-literal-enum-member.ts): prefers literal enum member initializers over computed expressions.
- [`typescript/prefer-namespace-keyword`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-namespace-keyword.ts): prefers `namespace` over TypeScript's legacy `module` keyword.
- [`typescript/prefer-nullish-coalescing`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-prefer-nullish-coalescing.ts): prefer `??` over `||` (and `??=` over `||=`, and `??` over the ternary `x ? x : y`) when the intent is to default `null` / `undefined`.
- [`typescript/prefer-optional-chain`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-prefer-optional-chain.ts): prefer an optional chain (`a?.b?.c`) over chained boolean guards such as `a && a.b && a.b.c` or `a != null && a.b`.
- [`typescript/prefer-promise-reject-errors`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-prefer-promise-reject-errors.ts): reject `Promise.reject(value)` where `value` is statically known not to derive from `Error` — type-aware analog of `only-throw-error` for the rejection side of the promise contract.
- [`typescript/prefer-readonly`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-prefer-readonly.ts): reject private class fields that could carry `readonly`.
- [`typescript/prefer-string-starts-ends-with`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-prefer-string-starts-ends-with.ts): prefer `str.startsWith(p)` / `str.endsWith(p)` over `str.indexOf(p) === 0`, `str.indexOf(p, str.length - p.length) !== -1`, `str.lastIndexOf(p) === str.length - p.length`, and the anchored-regex `/^p/.test(str)` / `/p$/.test(str)` idioms (type-aware).
- [`typescript/promise-function-async`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-promise-function-async.ts): require functions whose return type is `Promise<T>` to be declared with the `async` keyword so synchronous throws surface as a rejected Promise (type-aware).
- [`typescript/require-array-sort-compare`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-require-array-sort-compare.ts): require `arr.sort()` and `arr.toSorted()` calls to pass an explicit `compareFunction`.
- [`typescript/require-await`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/require-await.ts): reject `async` functions whose body contains no `await` expression.
- [`typescript/restrict-plus-operands`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-restrict-plus-operands.ts): rejects `+` expressions whose operands are not both `number`, both `string`, or both `bigint` (type-aware).
- [`typescript/restrict-template-expressions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-restrict-template-expressions.ts): reject template-literal interpolations whose expression carries a type that does not stringify cleanly — `${obj}` prints `"[object Object]"`, `${null}` prints `"null"`, and so on.
- [`typescript/return-await`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/return-await.ts): reject `return promise` inside `try`, `catch`, or `finally`; require `return await promise`.
- [`typescript/strict-boolean-expressions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-strict-boolean-expressions.ts): rejects non-boolean values used in a boolean context such as `if`, `&&`, `||`, or `!` (type-aware).
- [`typescript/switch-exhaustiveness-check`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-switch-exhaustiveness-check.ts): requires every member of a union or `enum` discriminant to be covered by a `case`, or a `default` clause to be present (type-aware).
- [`typescript/triple-slash-reference`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/triple-slash-reference/violation.ts): rejects triple-slash reference directives.
- [`typescript/unbound-method`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-unbound-method.ts): reject referencing a class instance method as a value instead of calling it (`obj.method` passed as a callback, aliased to a variable, or stored on another object).
- [`typescript/use-unknown-in-catch-callback-variable`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/use-unknown-in-catch-callback-variable.ts): require the callback parameter of `.catch(...)` and the second argument of `.then(...)` to be typed `unknown`.

### React

React TSX rules — Hooks correctness, JSX safety, the React Compiler subset, and Fast Refresh export shape. Bundles rules from three upstream plugins under one `react/*` namespace, matching Oxlint's layout. Performance-only rules live in [React performance](#react-performance) because they are opt-in toggles rather than correctness checks.

Source: [`eslint-plugin-react`](https://github.com/jsx-eslint/eslint-plugin-react), [`eslint-plugin-react-hooks`](https://github.com/facebook/react/tree/main/packages/eslint-plugin-react-hooks), [`eslint-plugin-react-refresh`](https://github.com/ArnaudBarre/eslint-plugin-react-refresh).

- [`react/button-has-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-button-has-type.tsx): requires explicit valid `type` values on JSX `button` elements.
- [`react/component-hook-factories`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-component-hook-factories.tsx): rejects nested component or Hook factories that call Hooks.
- [`react/display-name`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-display-name.tsx): require components wrapped in `React.memo(...)` or `React.forwardRef(...)` to be named — either by passing a named function, assigning the call to a named binding, or setting an explicit `displayName`.
- [`react/exhaustive-deps`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-exhaustive-deps.tsx): reports high-confidence missing identifier dependencies in `useEffect`, `useLayoutEffect`, `useInsertionEffect`, `useMemo`, and `useCallback`.
- [`react/iframe-missing-sandbox`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-iframe-missing-sandbox.tsx): requires JSX `iframe` elements to include a sandbox attribute.
- [`react/immutability`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-immutability.tsx): rejects local prop mutation inside components and Hooks.
- [`react/jsx-key`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-jsx-key.tsx): requires `key` props for JSX elements produced by arrays or `.map()`.
- [`react/jsx-no-duplicate-props`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-jsx-no-duplicate-props.tsx): rejects duplicate JSX prop names on the same element.
- [`react/jsx-no-script-url`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-jsx-no-script-url.tsx): rejects `javascript:` URLs in JSX URL-like props.
- [`react/jsx-no-target-blank`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-jsx-no-target-blank.tsx): reject `<a target="_blank">` (or any JSX element with `target="_blank"`) that does not also carry `rel="noreferrer"` (or `rel="noopener noreferrer"`).
- [`react/jsx-no-undef`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-jsx-no-undef.tsx): reject JSX elements whose tag is an uppercase identifier with no value-level declaration anywhere in the source file.
- [`react/jsx-no-useless-fragment`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-jsx-no-useless-fragment.tsx): reject JSX fragments that wrap exactly one element child or have no meaningful content — the child (or nothing) can be returned directly.
- [`react/no-array-index-key`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-no-array-index-key.tsx): rejects array map index parameters as JSX keys.
- [`react/no-children-prop`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-no-children-prop.tsx): rejects passing children through a JSX `children` prop.
- [`react/no-danger`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-no-danger.tsx): rejects `dangerouslySetInnerHTML`.
- [`react/no-danger-with-children`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-no-danger-with-children.tsx): rejects combining `dangerouslySetInnerHTML` with children.
- [`react/no-direct-mutation-state`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-no-direct-mutation-state.tsx): rejects direct writes to `this.state` outside constructor initialization.
- [`react/no-find-dom-node`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-no-find-dom-node.tsx): rejects `findDOMNode` calls.
- [`react/no-is-mounted`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-no-is-mounted.tsx): rejects `isMounted` calls.
- [`react/no-string-refs`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-no-string-refs.tsx): rejects string JSX refs.
- [`react/no-unescaped-entities`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-no-unescaped-entities.tsx): rejects unescaped `>`, `"`, `'`, and `}` in JSX text.
- [`react/only-export-components`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-only-export-components.tsx): keeps React Fast Refresh component modules from exporting non-components.
- [`react/refs`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-refs.tsx): rejects reading or writing `ref.current` during render.
- [`react/rules-of-hooks`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-rules-of-hooks.tsx): rejects Hooks called outside components or custom Hooks, in nested callbacks, or in conditional/loop control flow.
- [`react/set-state-in-effect`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-set-state-in-effect.tsx): rejects synchronous setter calls inside `useEffect`.
- [`react/set-state-in-render`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-set-state-in-render.tsx): rejects `useState` / `useReducer` setters called during render.
- [`react/style-prop-object`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-style-prop-object.tsx): rejects string literal JSX `style` prop values.
- [`react/use-memo`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-use-memo.tsx): rejects block-bodied `useMemo` callbacks that do not return a value.
- [`react/void-dom-elements-no-children`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-void-dom-elements-no-children.tsx): rejects children and HTML injection props on void DOM elements.

### React performance

Detects freshly-allocated reference values (arrays, objects, functions, JSX elements) passed as JSX props. A new reference invalidates `React.memo` / `useMemo` shallow checks on every render. Useful for performance-critical render paths; usually unnecessary for top-level pages. Diagnostics only fire on `.tsx` source files — JSX heuristics rely on the file extension, so `.ts` files are skipped even when they contain JSX-like syntax.

Source: [`eslint-plugin-react-perf`](https://github.com/cvazac/eslint-plugin-react-perf).

- [`react-perf/jsx-no-jsx-as-prop`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-perf-jsx-no-jsx-as-prop.tsx): rejects freshly-created JSX elements or fragments passed as JSX props.
- [`react-perf/jsx-no-new-array-as-prop`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-perf-jsx-no-new-array-as-prop.tsx): rejects freshly-created arrays passed as JSX props.
- [`react-perf/jsx-no-new-function-as-prop`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-perf-jsx-no-new-function-as-prop.tsx): rejects freshly-created functions passed as JSX props.
- [`react-perf/jsx-no-new-object-as-prop`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-perf-jsx-no-new-object-as-prop.tsx): rejects freshly-created objects passed as JSX props.

### JSX accessibility

JSX accessibility rules applied to TSX (and JSX-in-TS) sources. Checks the static structure of JSX elements against WAI-ARIA authoring guidance — interactive controls should be focusable, labels should reference a control, ARIA properties should match the element role, and so on. Runtime accessibility issues require live audits; this family catches the statically-decidable subset. Component alias settings, router-specific anchor settings, and autofixes are deferred.

Source: [`eslint-plugin-jsx-a11y`](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y).

- [`jsx-a11y/alt-text`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-alt-text.tsx): requires image-like JSX elements to expose alt text or an ARIA label.
- [`jsx-a11y/anchor-ambiguous-text`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-anchor-ambiguous-text.tsx): rejects `<a>` elements whose visible text is a phrase that carries no information out of context.
- [`jsx-a11y/anchor-has-content`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-anchor-has-content.tsx): rejects empty JSX anchors with no accessible content.
- [`jsx-a11y/anchor-is-valid`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-anchor-is-valid.tsx): rejects anchors with missing, `#`-only, empty, or `javascript:` `href` values.
- [`jsx-a11y/aria-activedescendant-has-tabindex`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-aria-activedescendant-has-tabindex.tsx): requires `tabIndex` on any element carrying `aria-activedescendant` that is not focusable by default.
- [`jsx-a11y/aria-props`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-aria-props.tsx): rejects `aria-*` JSX attribute names that are not part of the WAI-ARIA spec.
- [`jsx-a11y/aria-proptypes`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-aria-proptypes.tsx): validates literal ARIA property values against the type the spec declares for them.
- [`jsx-a11y/aria-role`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-aria-role.tsx): requires `role` values to be a concrete, non-abstract WAI-ARIA role.
- [`jsx-a11y/aria-unsupported-elements`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-aria-unsupported-elements.tsx): rejects ARIA roles and attributes on elements that do not support them.
- [`jsx-a11y/autocomplete-valid`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-autocomplete-valid.tsx): validates literal `autocomplete` tokens against the HTML spec and the surrounding input `type`.
- [`jsx-a11y/click-events-have-key-events`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-click-events-have-key-events.tsx): requires keyboard handlers alongside `onClick` on non-interactive JSX elements.
- [`jsx-a11y/control-has-associated-label`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-control-has-associated-label.tsx): requires interactive controls to have an accessible label.
- [`jsx-a11y/heading-has-content`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-heading-has-content.tsx): rejects empty JSX headings.
- [`jsx-a11y/html-has-lang`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-html-has-lang.tsx): requires `<html>` JSX elements to declare a non-empty `lang` attribute.
- [`jsx-a11y/iframe-has-title`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-iframe-has-title.tsx): requires every `<iframe>` JSX element to declare a non-empty, unique `title`.
- [`jsx-a11y/img-redundant-alt`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-img-redundant-alt.tsx): rejects redundant words such as *image*, *photo*, or *picture* inside the `alt` attribute of an `<img>`.
- [`jsx-a11y/interactive-supports-focus`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-interactive-supports-focus.tsx): requires elements with interactive ARIA roles to be focusable.
- [`jsx-a11y/label-has-associated-control`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-label-has-associated-control.tsx): requires `<label>` elements to wrap a form control or reference one via `htmlFor`.
- [`jsx-a11y/label-has-for`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-label-has-for.tsx): deprecated predecessor of `label-has-associated-control` that checks the same nesting / `htmlFor` association requirement.
- [`jsx-a11y/lang`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-lang.tsx): requires the `<html lang>` value to be a valid IETF BCP-47 tag.
- [`jsx-a11y/media-has-caption`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-media-has-caption.tsx): requires `<audio>` and `<video>` elements to provide a `<track kind="captions">` child.
- [`jsx-a11y/mouse-events-have-key-events`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-mouse-events-have-key-events.tsx): requires `onMouseOver` / `onMouseOut` handlers to have `onFocus` / `onBlur` parity.
- [`jsx-a11y/no-access-key`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-no-access-key.tsx): rejects the `accessKey` JSX attribute.
- [`jsx-a11y/no-aria-hidden-on-focusable`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-no-aria-hidden-on-focusable.tsx): rejects `aria-hidden` on focusable JSX elements.
- [`jsx-a11y/no-autofocus`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-no-autofocus.tsx): rejects `autoFocus` / `autofocus` JSX attributes.
- [`jsx-a11y/no-distracting-elements`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-no-distracting-elements.tsx): rejects `<blink>` and `<marquee>` elements whose motion cannot be paused.
- [`jsx-a11y/no-interactive-element-to-noninteractive-role`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-no-interactive-element-to-noninteractive-role.tsx): rejects non-interactive ARIA roles applied to natively interactive elements.
- [`jsx-a11y/no-noninteractive-element-interactions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-no-noninteractive-element-interactions.tsx): rejects interaction event handlers on known non-interactive elements without a role override.
- [`jsx-a11y/no-noninteractive-element-to-interactive-role`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-no-noninteractive-element-to-interactive-role.tsx): rejects interactive ARIA roles applied to non-interactive elements.
- [`jsx-a11y/no-noninteractive-tabindex`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-no-noninteractive-tabindex.tsx): rejects `tabIndex` on non-interactive JSX elements that have no interactive role.
- [`jsx-a11y/no-redundant-roles`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-no-redundant-roles.tsx): rejects explicit `role` attributes that duplicate the native semantics of the element.
- [`jsx-a11y/no-static-element-interactions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-no-static-element-interactions.tsx): requires static elements with interaction handlers to declare an interactive `role`.
- [`jsx-a11y/prefer-tag-over-role`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-prefer-tag-over-role.tsx): prefers native JSX tags over `div` / `span` plus an equivalent `role`.
- [`jsx-a11y/role-has-required-aria-props`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-role-has-required-aria-props.tsx): requires ARIA properties that the chosen role mandates.
- [`jsx-a11y/role-supports-aria-props`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-role-supports-aria-props.tsx): rejects ARIA properties that the role does not support.
- [`jsx-a11y/scope`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-scope.tsx): restricts the `scope` attribute to `<th>` cells.
- [`jsx-a11y/tabindex-no-positive`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-tabindex-no-positive.tsx): rejects `tabIndex` values greater than zero.

### Next.js

Next.js framework rules applied to TypeScript and TSX sources inside Next.js apps. Cover static TS/TSX Next.js source patterns the framework's runtime treats as load-bearing — pages/app routing, `<Head>` placement, font and script loading, image and link components, and common data export typos. Rules that need non-TypeScript files or runtime filesystem route discovery are intentionally conservative.

Source: [`@next/eslint-plugin-next`](https://github.com/vercel/next.js/tree/canary/packages/eslint-plugin-next).

- [`nextjs/google-font-display`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/nextjs-google-font-display.tsx): require `font-display` query on Google Font `<link>` URLs so initial render is not blocked.
- [`nextjs/google-font-preconnect`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/nextjs-google-font-preconnect.tsx): require `rel="preconnect"` for `fonts.gstatic.com` links to shave latency off Google Font fetches.
- [`nextjs/inline-script-id`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/nextjs-inline-script-id.tsx): require an `id` attribute on inline `<Script>` components from `next/script`.
- [`nextjs/next-script-for-ga`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/nextjs-next-script-for-ga.tsx): prefer the Next.js Google Analytics integration over hand-written `gtag` script tags.
- [`nextjs/no-assign-module-variable`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/nextjs-no-assign-module-variable.ts): reject local declarations named `module`, which shadow the CommonJS `module` binding Next.js relies on.
- [`nextjs/no-async-client-component`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/nextjs-no-async-client-component.tsx): reject `async` function bodies on React Client Components.
- [`nextjs/no-before-interactive-script-outside-document`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/nextjs-no-before-interactive-script-outside-document.tsx): restrict the `next/script` `strategy="beforeInteractive"` option to `pages/_document.tsx`.
- [`nextjs/no-css-tags`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/nextjs-no-css-tags.tsx): reject raw `<link rel="stylesheet">` tags.
- [`nextjs/no-document-import-in-page`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/nextjs-no-document-import-in-page.tsx): restrict `next/document` imports to `pages/_document.tsx`.
- [`nextjs/no-duplicate-head`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/nextjs-no-duplicate-head.tsx): reject more than one `<Head>` element from `next/document` in `pages/_document.tsx`.
- [`nextjs/no-head-element`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/nextjs-no-head-element.tsx): reject raw `<head>` elements outside the `app/` directory.
- [`nextjs/no-head-import-in-document`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/nextjs-no-head-import-in-document.tsx): reject `next/head` imports inside `pages/_document.tsx`.
- [`nextjs/no-html-link-for-pages`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/nextjs-no-html-link-for-pages.tsx): prefer `next/link` for internal anchors with a static `href`.
- [`nextjs/no-img-element`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/nextjs-no-img-element.tsx): prefer `next/image` over raw `<img>` elements so the framework can optimize the asset.
- [`nextjs/no-page-custom-font`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/nextjs-no-page-custom-font.tsx): reject Google font `<link>` tags inside regular pages files.
- [`nextjs/no-script-component-in-head`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/nextjs-no-script-component-in-head.tsx): reject `next/script` inside `next/head`.
- [`nextjs/no-styled-jsx-in-document`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/nextjs-no-styled-jsx-in-document.tsx): reject styled-jsx tags inside `pages/_document.tsx`.
- [`nextjs/no-sync-scripts`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/nextjs-no-sync-scripts.tsx): require `async` or `defer` on external raw `<script>` tags.
- [`nextjs/no-title-in-document-head`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/nextjs-no-title-in-document-head.tsx): reject `<title>` inside `Head` from `next/document`.
- [`nextjs/no-typos`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/nextjs-no-typos.ts): catch near-miss typos in Next.js data-fetching export names (`getStaticProps`, `getStaticPaths`, `getServerSideProps`).
- [`nextjs/no-unwanted-polyfillio`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/nextjs-no-unwanted-polyfillio.tsx): reject Polyfill.io script URLs.

### Solid

Solid TSX rules. Solid components compile to fine-grained reactivity, so patterns that look correct in React (destructuring props, calling `useEffect`-style hooks with array deps) silently break reactivity in Solid. AST-only, high-confidence Solid patterns after a Solid import is present.

Source: [`eslint-plugin-solid`](https://github.com/solidjs-community/eslint-plugin-solid).

- [`solid/components-return-once`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/solid-components-return-once.tsx): reject early returns inside Solid components that break the once-only setup contract.
- [`solid/event-handlers`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/solid-event-handlers.tsx): reject lowercase string event handlers that are forwarded as plain attributes.
- [`solid/imports`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/solid-imports.tsx): require Solid APIs to be imported from their canonical modules.
- [`solid/jsx-no-duplicate-props`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/solid-jsx-no-duplicate-props.tsx): reject duplicate JSX attributes on the same element.
- [`solid/jsx-no-script-url`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/solid-jsx-no-script-url.tsx): reject `javascript:` URLs on JSX `href`/`src` literals.
- [`solid/jsx-no-undef`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/solid-jsx-no-undef.tsx): reject JSX component tags with no in-scope binding.
- [`solid/jsx-uses-vars`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/solid-jsx-uses-vars.tsx): accepted for config compatibility; emits no diagnostics because `@ttsc/lint` does not run ESLint's unused-variable marker pass.
- [`solid/no-array-handlers`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/solid-no-array-handlers.tsx): reject array-form `[handler, data]` event handlers easily confused with React dep arrays.
- [`solid/no-destructure`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/solid-no-destructure.tsx): reject destructured component props that lose reactive accessor wiring.
- [`solid/no-innerhtml`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/solid-no-innerhtml.tsx): reject `innerHTML` JSX props that bypass the reconciler.
- [`solid/no-proxy-apis`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/solid-no-proxy-apis.tsx): reject direct `new Proxy(...)` construction that defeats fine-grained tracking.
- [`solid/no-react-deps`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/solid-no-react-deps.tsx): reject React-style dependency arrays passed to `createEffect`/`createMemo`/`createComputed`.
- [`solid/no-react-specific-props`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/solid-no-react-specific-props.tsx): reject React-only JSX prop names like `className`, `htmlFor`, and `key`.
- [`solid/no-unknown-namespaces`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/solid-no-unknown-namespaces.tsx): reject JSX namespaced attributes outside Solid's known prefixes.
- [`solid/prefer-classlist`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/solid-prefer-classlist.tsx): prefer the `classList` JSX prop over `clsx`/`classnames` calls.
- [`solid/prefer-for`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/solid-prefer-for.tsx): prefer the `<For>` component over `Array#map` for JSX list rendering.
- [`solid/prefer-show`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/solid-prefer-show.tsx): prefer the `<Show>` component over `cond && <JSX />` conditionals.
- [`solid/reactivity`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/solid-reactivity.tsx): flag bare signal accessors that break fine-grained reactivity tracking.
- [`solid/self-closing-comp`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/solid-self-closing-comp.tsx): require empty JSX components to use the self-closing form.
- [`solid/style-prop`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/solid-style-prop.tsx): reject camelCased CSS keys in JSX `style` object literals.
- [`solid/validate-jsx-nesting`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/solid-validate-jsx-nesting.tsx): reject JSX nestings that the HTML parser would silently restructure at runtime — `<p>` cannot contain block-level children, `<a>` cannot contain another `<a>`, and `<button>` cannot contain other interactive elements.

### Jest

Jest test source rules. Apply to TypeScript test files that use the Jest runner (`describe`, `test`/`it`, `expect`, lifecycle hooks). Guard test-quality patterns the type system cannot detect — unended assertions, focused tests left behind, duplicate hook calls.

Source: [`eslint-plugin-jest`](https://github.com/jest-community/eslint-plugin-jest).

- [`jest/expect-expect`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jest-expect-expect.ts): require every Jest test body to contain at least one `expect(...)` call.
- [`jest/max-expects`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jest-max-expects.ts): limit the number of `expect(...)` calls inside a single Jest test body.
- [`jest/no-conditional-expect`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jest-no-conditional-expect.ts): reject `expect(...)` calls under conditional branches in Jest tests.
- [`jest/no-conditional-in-test`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jest-no-conditional-in-test.ts): reject conditional logic (`if`/`switch`/ternary) inside Jest test bodies.
- [`jest/no-disabled-tests`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jest-no-disabled-tests.ts): reject `test.skip` / `it.skip` / `describe.skip` / `.todo` variants.
- [`jest/no-done-callback`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jest-no-done-callback.ts): reject `done` callback parameters in Jest tests and lifecycle hooks.
- [`jest/no-duplicate-hooks`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jest-no-duplicate-hooks.ts): reject duplicate setup/teardown hook calls in the same `describe`.
- [`jest/no-export`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jest-no-export.ts): reject `export` statements inside Jest test files.
- [`jest/no-focused-tests`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jest-no-focused-tests.ts): reject `test.only` / `it.only` / `describe.only`.
- [`jest/no-hooks`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jest-no-hooks.ts): reject Jest `beforeEach` / `afterEach` / `beforeAll` / `afterAll` hooks.
- [`jest/no-identical-title`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jest-no-identical-title.ts): reject duplicate Jest test or `describe` titles within the same suite scope.
- [`jest/no-standalone-expect`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jest-no-standalone-expect.ts): reject `expect(...)` calls outside Jest tests and hooks.
- [`jest/no-test-prefixes`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jest-no-test-prefixes.ts): reject the legacy `f`/`x` test prefixes (`fit`, `xit`, `fdescribe`, `xdescribe`).
- [`jest/no-test-return-statement`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jest-no-test-return-statement.ts): reject `return` statements that return non-Promise values from a Jest test callback.
- [`jest/prefer-to-have-length`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jest-prefer-to-have-length.ts): prefer `expect(value).toHaveLength(n)` over asserting on `value.length` with `toBe`.
- [`jest/require-to-throw-message`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jest-require-to-throw-message.ts): require a message argument on `expect(...).toThrow(...)`.
- [`jest/valid-describe-callback`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jest-valid-describe-callback.ts): validate the shape of Jest `describe` callbacks.
- [`jest/valid-expect`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jest-valid-expect.ts): validate `expect(...)` arity and matcher chaining: exactly one argument, terminated by a matcher call, and async matchers properly awaited.
- [`jest/valid-title`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jest-valid-title.ts): require non-empty static Jest test and `describe` titles.

### Vitest

Vitest test source rules. Vitest reuses much of Jest's testing surface but ships its own runner and configuration. These rules mirror the ergonomic subset of `eslint-plugin-jest` adapted for Vitest semantics — focused or disabled tests, duplicate titles, missing or conditional assertions, standalone `expect` calls, done callbacks, invalid `expect` chains, invalid titles, returned test values, and `.length` assertions that should use `toHaveLength`.

Source: [`@vitest/eslint-plugin`](https://github.com/vitest-dev/eslint-plugin-vitest).

- [`vitest/expect-expect`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/vitest-expect-expect.ts): require every Vitest test body to contain at least one `expect(...)` call.
- [`vitest/no-conditional-expect`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/vitest-no-conditional-expect.ts): reject `expect(...)` calls under conditional branches in Vitest tests.
- [`vitest/no-conditional-tests`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/vitest-no-conditional-tests.ts): reject `test(...)` / `it(...)` declarations inside loops or `if` branches.
- [`vitest/no-disabled-tests`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/vitest-no-disabled-tests.ts): reject `test.skip`, `it.skip`, `describe.skip`, and `.todo` variants.
- [`vitest/no-done-callback`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/vitest-no-done-callback.ts): reject `done` callback parameters in Vitest tests and lifecycle hooks.
- [`vitest/no-focused-tests`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/vitest-no-focused-tests.ts): reject `test.only`, `it.only`, and `describe.only`.
- [`vitest/no-identical-title`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/vitest-no-identical-title.ts): reject duplicate Vitest test or `describe` titles within the same suite scope.
- [`vitest/no-standalone-expect`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/vitest-no-standalone-expect.ts): reject `expect(...)` calls outside Vitest tests and hooks.
- [`vitest/no-test-return-statement`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/vitest-no-test-return-statement.ts): reject `return` statements that return non-Promise values from a Vitest test callback.
- [`vitest/prefer-to-have-length`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/vitest-prefer-to-have-length.ts): prefer `expect(value).toHaveLength(n)` over asserting on `value.length` with `toBe`.
- [`vitest/valid-describe-callback`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/vitest-valid-describe-callback.ts): validate the shape of Vitest `describe` callbacks.
- [`vitest/valid-expect`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/vitest-valid-expect.ts): validate `expect(...)` arity and matcher chaining.
- [`vitest/valid-title`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/vitest-valid-title.ts): require non-empty static Vitest test and `describe` titles.

### Testing Library

Testing Library test source rules for TS/TSX test files. AST-only; rules report only after a Testing Library import is present in the file.

Source: [`eslint-plugin-testing-library`](https://github.com/testing-library/eslint-plugin-testing-library).

- [`testing-library/await-async-events`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-await-async-events.ts): require Promise-returning user-event methods to be awaited.
- [`testing-library/await-async-queries`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-await-async-queries.ts): require `findBy*` queries to be awaited.
- [`testing-library/await-async-utils`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-await-async-utils.ts): require async utilities such as `waitFor` to be awaited.
- [`testing-library/no-await-sync-events`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-no-await-sync-events.ts): reject `await` on synchronous `fireEvent.*` calls.
- [`testing-library/no-await-sync-queries`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-no-await-sync-queries.ts): reject `await` on synchronous `getBy*` and `queryBy*` queries.
- [`testing-library/no-container`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-no-container.ts): reject destructuring or accessing the render-result `container`.
- [`testing-library/no-node-access`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-no-node-access.ts): reject DOM traversal (`parentElement`, `children`, ...) off a query result.
- [`testing-library/prefer-screen-queries`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-prefer-screen-queries.ts): prefer `screen.*` queries over render-result query functions.
- [`testing-library/no-debugging-utils`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-no-debugging-utils.ts): reject committed debug helpers such as `debug()` and `logTestingPlaygroundURL()`.
- [`testing-library/no-dom-import`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-no-dom-import.ts): reject direct imports from `@testing-library/dom` in favor of the framework adapter.
- [`testing-library/no-manual-cleanup`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-no-manual-cleanup.ts): reject manual `cleanup()` calls when the runner registers them automatically.
- [`testing-library/no-test-id-queries`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-no-test-id-queries.ts): reject `*ByTestId` queries in favor of accessibility-driven queries.
- [`testing-library/no-wait-for-multiple-assertions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-no-wait-for-multiple-assertions.ts): reject more than one `expect(...)` inside a single `waitFor` callback.
- [`testing-library/no-wait-for-side-effects`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-no-wait-for-side-effects.ts): reject mutating calls (e.g. `fireEvent.*`) inside a `waitFor` callback.
- [`testing-library/no-wait-for-snapshot`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-no-wait-for-snapshot.ts): reject `toMatchSnapshot` / `toMatchInlineSnapshot` inside a `waitFor` callback.
- [`testing-library/prefer-find-by`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-prefer-find-by.ts): prefer `findBy*` over `waitFor(() => getBy*(...))`.
- [`testing-library/prefer-query-by-disappearance`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-prefer-query-by-disappearance.ts): prefer `queryBy*` when waiting for an element to disappear.
- [`testing-library/prefer-user-event`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-prefer-user-event.ts): prefer `user-event` interactions over equivalent `fireEvent.*` calls.
- [`testing-library/prefer-user-event-setup`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-prefer-user-event-setup.ts): require direct user-event interactions to go through `userEvent.setup()`.
- [`testing-library/no-promise-in-fire-event`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-no-promise-in-fire-event.ts): reject passing Promise-returning expressions into `fireEvent.*` arguments.
- [`testing-library/no-render-in-lifecycle`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-no-render-in-lifecycle.ts): reject `render()` calls inside `beforeEach` and other lifecycle hooks.
- [`testing-library/no-unnecessary-act`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-no-unnecessary-act.ts): reject wrapping Testing Library calls in `act(...)` when the helper already wraps them.
- [`testing-library/consistent-data-testid`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-consistent-data-testid.ts): require `data-testid` values to match the configured `testIdPattern`.
- [`testing-library/no-global-regexp-flag-in-query`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-no-global-regexp-flag-in-query.ts): reject `/g` regex flags inside Testing Library query arguments.
- [`testing-library/prefer-explicit-assert`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-prefer-explicit-assert.ts): reject standalone `getBy*` queries used as implicit assertions.
- [`testing-library/prefer-implicit-assert`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-prefer-implicit-assert.ts): reject redundant `toBeInTheDocument()` matchers around `getBy*` queries.
- [`testing-library/prefer-presence-queries`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-prefer-presence-queries.ts): require presence assertions to use `getBy*` and absence assertions to use `queryBy*`.
- [`testing-library/prefer-query-matchers`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-prefer-query-matchers.ts): reject truthiness matchers (`toBeNull`, `toBeTruthy`, `toBeFalsy`) around Testing Library queries.
- [`testing-library/render-result-naming-convention`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/testing-library-render-result-naming-convention.ts): require `render()` results to be named `view`, `utils`, or destructured.

### Playwright

Playwright end-to-end test rules applied to TypeScript test files driven by the `@playwright/test` runner. Guard Playwright-specific patterns — locator usage, web-first assertions, focused/slowed tests — that would otherwise compile and run silently.

Source: [`eslint-plugin-playwright`](https://github.com/playwright-community/eslint-plugin-playwright).

- [`playwright/expect-expect`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-expect-expect.ts): require every Playwright test body to contain at least one `expect(...)` call.
- [`playwright/max-expects`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-max-expects.ts): limit the assertion count inside a single Playwright test body.
- [`playwright/no-conditional-expect`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-no-conditional-expect.ts): reject `expect(...)` calls under conditional branches in Playwright tests.
- [`playwright/no-conditional-in-test`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-no-conditional-in-test.ts): reject conditional logic inside Playwright test bodies.
- [`playwright/no-duplicate-hooks`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-no-duplicate-hooks.ts): reject duplicate Playwright setup/teardown hook calls in the same `test.describe`.
- [`playwright/no-duplicate-slow`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-no-duplicate-slow.ts): reject repeated `test.slow()` calls inside the same test.
- [`playwright/no-element-handle`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-no-element-handle.ts): reject the legacy `ElementHandle`-style Playwright API (`page.$`, `page.$$`).
- [`playwright/no-eval`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-no-eval.ts): reject `page.$eval` and `page.$$eval`.
- [`playwright/no-focused-test`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-no-focused-test.ts): reject `test.only`, `test.describe.only`, and similar focused Playwright tests.
- [`playwright/no-force-option`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-no-force-option.ts): reject Playwright `{ force: true }` options on actionable commands.
- [`playwright/no-get-by-title`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-no-get-by-title.ts): reject `getByTitle(...)` locators.
- [`playwright/no-hooks`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-no-hooks.ts): reject Playwright `test.beforeEach` / `test.afterEach` / etc.
- [`playwright/no-nested-step`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-no-nested-step.ts): reject nested `test.step(...)` calls.
- [`playwright/no-networkidle`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-no-networkidle.ts): reject the `networkidle` load-state in `page.waitForLoadState` and navigation options.
- [`playwright/no-nth-methods`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-no-nth-methods.ts): reject `.first()`, `.last()`, and `.nth(...)` on locators.
- [`playwright/no-page-pause`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-no-page-pause.ts): reject `page.pause()` debugging calls.
- [`playwright/no-skipped-test`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-no-skipped-test.ts): reject `test.skip`, `test.describe.skip`, and the conditional `test.skip()` annotation.
- [`playwright/no-slowed-test`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-no-slowed-test.ts): reject `test.slow()` marks on Playwright tests.
- [`playwright/no-standalone-expect`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-no-standalone-expect.ts): reject `expect(...)` calls outside the body of a Playwright test or lifecycle hook.
- [`playwright/no-wait-for-navigation`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-no-wait-for-navigation.ts): reject `page.waitForNavigation`.
- [`playwright/no-wait-for-selector`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-no-wait-for-selector.ts): reject `page.waitForSelector`.
- [`playwright/no-wait-for-timeout`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-no-wait-for-timeout.ts): reject `page.waitForTimeout(ms)` sleeps.
- [`playwright/prefer-locator`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-prefer-locator.ts): prefer locator-based Playwright APIs over page-level convenience methods.
- [`playwright/prefer-to-have-count`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-prefer-to-have-count.ts): prefer `expect(locator).toHaveCount(n)` over asserting on `await locator.count()`.
- [`playwright/prefer-to-have-length`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-prefer-to-have-length.ts): prefer `expect(value).toHaveLength(n)` over asserting on `value.length` directly.
- [`playwright/prefer-web-first-assertions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-prefer-web-first-assertions.ts): prefer Playwright web-first assertions over composed manual waits.
- [`playwright/require-to-pass-timeout`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-require-to-pass-timeout.ts): require an explicit `timeout` option on `expect(...).toPass(...)`.
- [`playwright/require-to-throw-message`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-require-to-throw-message.ts): require a message argument on `expect(...).toThrow(...)`.
- [`playwright/valid-describe-callback`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-valid-describe-callback.ts): validate the shape of Playwright `test.describe` callbacks.
- [`playwright/valid-expect`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-valid-expect.ts): validate `expect(...)` arity and matcher chaining.
- [`playwright/valid-title`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/playwright-valid-title.ts): require non-empty static Playwright test and `describe` titles.

### Cypress

Cypress end-to-end test rules. Apply to TypeScript/TSX sources that use the Cypress runner (`cy.*` commands and Mocha-style `describe`/`it` blocks). Detect Cypress-specific anti-patterns such as async test bodies, missing assertions before screenshots, or deprecated XPath selectors.

Source: [`eslint-plugin-cypress`](https://github.com/cypress-io/eslint-plugin-cypress).

- [`cypress/assertion-before-screenshot`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/cypress-assertion-before-screenshot.ts): require a Cypress assertion before `cy.screenshot()`.
- [`cypress/no-and`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/cypress-no-and.ts): prefer `.should()` over `.and()` when starting Cypress assertion chains.
- [`cypress/no-assigning-return-values`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/cypress-no-assigning-return-values.ts): reject assigning the return value of Cypress commands.
- [`cypress/no-async-before`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/cypress-no-async-before.ts): reject async `before` and `beforeEach` callbacks.
- [`cypress/no-async-tests`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/cypress-no-async-tests.ts): reject async Cypress test callbacks.
- [`cypress/no-chained-get`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/cypress-no-chained-get.ts): reject chained `.get()` calls.
- [`cypress/no-debug`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/cypress-no-debug.ts): reject `cy.debug()` and chained `.debug()` commands.
- [`cypress/no-force`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/cypress-no-force.ts): reject `{ force: true }` on Cypress action commands.
- [`cypress/no-pause`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/cypress-no-pause.ts): reject `cy.pause()` and chained `.pause()` commands.
- [`cypress/no-unnecessary-waiting`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/cypress-no-unnecessary-waiting.ts): reject numeric `cy.wait(...)` sleeps.
- [`cypress/no-xpath`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/cypress-no-xpath.ts): reject deprecated `cy.xpath()` selectors.
- [`cypress/require-data-selectors`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/cypress-require-data-selectors.ts): require statically known `cy.get()` selectors to target `data-*` attributes.
- [`cypress/unsafe-to-chain-command`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/cypress-unsafe-to-chain-command.ts): reject chaining more commands after Cypress action commands.

### Storybook

Storybook CSF and configuration rules. Apply to `*.stories.ts(x)` and `.storybook/main.ts` files. Cover CSF metadata shape, named story exports, deprecated `storiesOf`, interaction-test imports, direct renderer-package imports, and addon installation checks. `storybook/no-uninstalled-addons` accepts `{ packageJsonLocation?: string; ignore?: string[] }`; without an explicit path it walks upward from the linted Storybook config file to find `package.json`.

Source: [`eslint-plugin-storybook`](https://github.com/storybookjs/eslint-plugin-storybook).

- [`storybook/await-interactions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/storybook-await-interactions.ts): require play-function interactions to be awaited.
- [`storybook/context-in-play-function`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/storybook-context-in-play-function.ts): require forwarding the play-function `context` argument when invoking another story's `play` function.
- [`storybook/csf-component`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/storybook-csf-component.ts): require the CSF default meta object to declare a `component`.
- [`storybook/default-exports`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/storybook-default-exports.ts): require every story file to provide the CSF default export.
- [`storybook/hierarchy-separator`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/storybook-hierarchy-separator.ts): reject the legacy `|` separator in Storybook story titles.
- [`storybook/meta-inline-properties`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/storybook-meta-inline-properties.ts): require `title` and `args` in CSF meta to be inline literals.
- [`storybook/meta-satisfies-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/storybook-meta-satisfies-type.ts): require CSF meta objects to type-check with `satisfies Meta<…>` rather than a `: Meta<…>` annotation or `as` cast.
- [`storybook/no-redundant-story-name`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/storybook-no-redundant-story-name.ts): reject `name` metadata on a story when it matches Storybook's auto-derived name from the export identifier.
- [`storybook/no-renderer-packages`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/storybook-no-renderer-packages.ts): reject direct imports from Storybook renderer packages.
- [`storybook/no-stories-of`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/storybook-no-stories-of.ts): reject the legacy `storiesOf(...)` builder API.
- [`storybook/no-title-property-in-meta`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/storybook-no-title-property-in-meta.ts): reject the `title` property in CSF meta when the project uses Storybook's auto-title generation.
- [`storybook/no-uninstalled-addons`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/storybook-no-uninstalled-addons.ts): validate Storybook addon names against the project's dependencies.
- [`storybook/prefer-pascal-case`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/storybook-prefer-pascal-case.ts): require named story exports to use PascalCase.
- [`storybook/story-exports`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/storybook-story-exports.ts): require every story file to export at least one named story alongside the default meta.
- [`storybook/use-storybook-expect`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/storybook-use-storybook-expect.ts): require `expect` to be imported from `@storybook/test` in play functions.
- [`storybook/use-storybook-testing-library`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/storybook-use-storybook-testing-library.ts): reject direct Testing Library imports inside story files; use the Storybook-bundled re-exports.

### TanStack Query

TanStack Query rules. Guard the ergonomic and correctness contracts of TanStack Query (`useQuery`, `useMutation`, query-options factories) inside React TypeScript sources.

Source: [`@tanstack/eslint-plugin-query`](https://github.com/TanStack/query/tree/main/packages/eslint-plugin-query).

- [`tanstack-query/exhaustive-deps`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/tanstack-query-exhaustive-deps.ts): require `queryKey` arrays to enumerate every reactive identifier the `queryFn` reads.
- [`tanstack-query/infinite-query-property-order`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/tanstack-query-infinite-query-property-order.ts): require `queryFn`, `getPreviousPageParam`, and `getNextPageParam` inside `useInfiniteQuery` to appear in the order TanStack Query documents.
- [`tanstack-query/mutation-property-order`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/tanstack-query-mutation-property-order.ts): require `useMutation` callbacks to declare `onMutate` before `onError` and `onSettled`.
- [`tanstack-query/no-rest-destructuring`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/tanstack-query-no-rest-destructuring.ts): reject `...rest` destructuring on TanStack Query hook results.
- [`tanstack-query/no-unstable-deps`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/tanstack-query-no-unstable-deps.ts): reject passing entire TanStack Query hook results into React dependency arrays.
- [`tanstack-query/no-void-query-fn`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/tanstack-query-no-void-query-fn.ts): reject `queryFn` callbacks that resolve to `void`.
- [`tanstack-query/prefer-query-options`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/tanstack-query-prefer-query-options.ts): prefer wrapping query options in the `queryOptions()` helper.
- [`tanstack-query/stable-query-client`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/tanstack-query-stable-query-client.ts): reject creating a `QueryClient` inside a React component or hook body.

### Promise

Promise correctness and style rules. Check the chain shape of Promise-using code: every chain ends with `catch`, no callback inside a `then`, no nested `.then().then()`, and so on. AST-local only — type-aware Promise checks belong with `typescript/*` checker rules.

Source: [`eslint-plugin-promise`](https://github.com/eslint-community/eslint-plugin-promise).

- [`promise/always-return`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/promise-always-return.ts): require `.then(...)` callbacks to return a value or throw.
- [`promise/avoid-new`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/promise-avoid-new.ts): reject every `new Promise(...)` construction.
- [`promise/catch-or-return`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/promise-catch-or-return.ts): require unreturned promise chains to terminate with `catch()`.
- [`promise/no-callback-in-promise`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/promise-no-callback-in-promise.ts): reject direct invocation of an error-first callback inside a `then()` or `catch()` handler.
- [`promise/no-multiple-resolved`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/promise-no-multiple-resolved.ts): detect Promise executor bodies with more than one resolve/reject call.
- [`promise/no-native`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/promise-no-native.ts): require every file that uses `Promise` to import or require the implementation explicitly.
- [`promise/no-nesting`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/promise-no-nesting.ts): reject nested `then()`/`catch()` calls inside the body of a Promise callback.
- [`promise/no-new-statics`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/promise-no-new-statics.ts): reject `new` applied to Promise statics such as `new Promise.resolve(x)`.
- [`promise/no-promise-in-callback`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/promise-no-promise-in-callback.ts): reject building a promise chain inside the body of an error-first callback.
- [`promise/no-return-in-finally`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/promise-no-return-in-finally.ts): reject `return` from inside a `finally()` callback.
- [`promise/no-return-wrap`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/promise-no-return-wrap.ts): reject `return Promise.resolve(x)` and `return Promise.reject(x)` inside promise callbacks.
- [`promise/param-names`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/promise-param-names.ts): enforce canonical parameter names (`resolve`, `reject`) on Promise executor functions.
- [`promise/prefer-await-to-callbacks`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/promise-prefer-await-to-callbacks.ts): flag continuation-passing callback shapes and suggest an `async`/`await` rewrite.
- [`promise/prefer-await-to-then`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/promise-prefer-await-to-then.ts): prefer `await` over explicit `.then()`/`.catch()`/`.finally()` chains inside `async` functions.
- [`promise/prefer-catch`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/promise-prefer-catch.ts): prefer `.catch(handler)` over the two-argument form `.then(onFulfilled, onRejected)`.
- [`promise/spec-only`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/promise-spec-only.ts): reject non-standard `Promise` statics such as `Promise.done`, `Promise.spread`, or library-specific extensions shimmed onto the global.
- [`promise/valid-params`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/promise-valid-params.ts): enforce the argument counts the Promise spec defines for each method.

### Regular expressions

Regex-shape rules. Check the structure of regex literals — emptiness, uselessness, flag ordering, shorthand classes, Unicode support. Some rules supersede the regex-related rules in [ESLint core](#eslint-core); both ids exist so projects can keep the legacy ESLint names alongside the regexp-plugin variants.

Source: [`eslint-plugin-regexp`](https://github.com/ota-meshi/eslint-plugin-regexp).

- [`regexp/no-control-character`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/regexp-no-control-character.ts): reject control characters (`\x00`–`\x1F`) embedded in regex literals.
- [`regexp/no-dupe-characters-character-class`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/regexp-no-dupe-characters-character-class.ts): reject duplicate literal characters inside simple regex character classes (`/[aa]/`).
- [`regexp/no-empty-alternative`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/regexp-no-empty-alternative.ts): reject empty alternatives in a disjunction (`/a||b/`).
- [`regexp/no-empty-capturing-group`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/regexp-no-empty-capturing-group.ts): reject empty capturing groups such as `/()/`.
- [`regexp/no-empty-character-class`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/regexp-no-empty-character-class.ts): reject empty regex character classes (`[]`).
- [`regexp/no-empty-group`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/regexp-no-empty-group.ts): reject empty non-capturing groups such as `/(?:)/`.
- [`regexp/no-empty-lookarounds-assertion`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/regexp-no-empty-lookarounds-assertion.ts): reject empty lookaround assertions such as `/(?=)/` or `/(?!)/`.
- [`regexp/no-misleading-unicode-character`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/regexp-no-misleading-unicode-character.ts): reject misleading Unicode characters in regex classes.
- [`regexp/no-useless-character-class`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/regexp-no-useless-character-class.ts): reject single-character character classes such as `/[x]/`.
- [`regexp/no-useless-escape`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/regexp-no-useless-escape.ts): reject unnecessary escapes inside regex literals.
- [`regexp/no-useless-flag`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/regexp-no-useless-flag.ts): reject regex flags that the literal does not exercise.
- [`regexp/no-useless-quantifier`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/regexp-no-useless-quantifier.ts): reject quantifiers that do not change the match.
- [`regexp/no-useless-two-nums-quantifier`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/regexp-no-useless-two-nums-quantifier.ts): reject equal min/max quantifiers (`/a{2,2}/`) in favor of `/a{2}/`.
- [`regexp/no-zero-quantifier`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/regexp-no-zero-quantifier.ts): reject zero-repeat quantifiers (`/a{0}/`, `/a{0,0}/`).
- [`regexp/prefer-d`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/regexp-prefer-d.ts): prefer `\d` over `[0-9]` in regex literals.
- [`regexp/prefer-plus-quantifier`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/regexp-prefer-plus-quantifier.ts): prefer `+` over `{1,}` in regex literals.
- [`regexp/prefer-question-quantifier`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/regexp-prefer-question-quantifier.ts): prefer `?` over `{0,1}` in regex literals.
- [`regexp/prefer-star-quantifier`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/regexp-prefer-star-quantifier.ts): prefer `*` over `{0,}` in regex literals.
- [`regexp/prefer-w`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/regexp-prefer-w.ts): prefer `\w` over `[A-Za-z0-9_]` in regex literals.
- [`regexp/require-unicode-regexp`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/regexp-require-unicode-regexp.ts): require regex literals to use the `u` or `v` flag.
- [`regexp/require-unicode-sets-regexp`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/regexp-require-unicode-sets-regexp.ts): require regex literals to use the `v` flag specifically.
- [`regexp/sort-flags`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/regexp-sort-flags.ts): require regex flags to appear in canonical alphabetical order (`dgimsuvy`).

### Security

Security-focused TypeScript source rules. Report likely security smells — non-literal sinks for eval, file I/O, regex construction, child-process spawning, cryptographic primitives — that warrant human review even if no exploit is statically provable. Treat findings as *hints*, not proofs.

Source: [`eslint-plugin-security@4.0.0`](https://github.com/eslint-community/eslint-plugin-security).

- [`security/detect-bidi-characters`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/security-detect-bidi-characters.ts): detect Trojan Source bidi control characters.
- [`security/detect-buffer-noassert`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/security-detect-buffer-noassert.ts): detect Buffer reads/writes with `noAssert` set to true.
- [`security/detect-child-process`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/security-detect-child-process.ts): detect child_process imports and non-literal `exec` commands.
- [`security/detect-disable-mustache-escape`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/security-detect-disable-mustache-escape.ts): detect `escapeMarkup = false` on objects.
- [`security/detect-eval-with-expression`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/security-detect-eval-with-expression.ts): detect `eval` fed by non-literal expressions.
- [`security/detect-new-buffer`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/security-detect-new-buffer.ts): detect `new Buffer` with non-literal input.
- [`security/detect-no-csrf-before-method-override`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/security-detect-no-csrf-before-method-override.ts): detect Express csrf middleware before methodOverride.
- [`security/detect-non-literal-fs-filename`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/security-detect-non-literal-fs-filename.ts): detect filesystem calls with non-literal filename arguments.
- [`security/detect-non-literal-regexp`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/security-detect-non-literal-regexp.ts): detect RegExp construction from non-literal patterns.
- [`security/detect-non-literal-require`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/security-detect-non-literal-require.ts): detect `require` calls with non-literal module specifiers.
- [`security/detect-object-injection`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/security-detect-object-injection.ts): detect dynamic bracket access sinks.
- [`security/detect-possible-timing-attacks`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/security-detect-possible-timing-attacks.ts): detect direct equality comparisons involving secret-like identifiers.
- [`security/detect-pseudoRandomBytes`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/security-detect-pseudoRandomBytes.ts): detect `crypto.pseudoRandomBytes`.
- [`security/detect-unsafe-regex`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/security-detect-unsafe-regex.ts): detect high-confidence catastrophic backtracking regex shapes.

### JSDoc

Documentation-comment validation rules. Bundles `eslint-plugin-jsdoc` content checks (tag names, parameter coverage, descriptions) with the lone `eslint-plugin-tsdoc` syntax check (`jsdoc/tsdoc-syntax`) — both target `/** ... */` comments. Formatting concerns (alignment, indentation) are configured through the top-level [`format`](#format) block, not here.

Source: [`eslint-plugin-jsdoc`](https://github.com/gajus/eslint-plugin-jsdoc), [`eslint-plugin-tsdoc`](https://github.com/microsoft/tsdoc).

- [`jsdoc/check-tag-names`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsdoc-check-tag-names.ts): reject unknown JSDoc block tag names.
- [`jsdoc/check-values`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsdoc-check-values.ts): validate closed-set JSDoc tag values such as `@access`.
- [`jsdoc/empty-tags`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsdoc-empty-tags.ts): reject content on marker-only JSDoc tags such as `@async`.
- [`jsdoc/no-types`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsdoc-no-types.ts): reject redundant JSDoc type braces in TypeScript source comments.
- [`jsdoc/reject-any-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsdoc-reject-any-type.ts): reject `any` and `*` inside JSDoc type braces.
- [`jsdoc/reject-function-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsdoc-reject-function-type.ts): reject the unsafe `Function` type inside JSDoc type braces.
- [`jsdoc/require-description`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsdoc-require-description.ts): require JSDoc blocks to include block-level description text.
- [`jsdoc/require-param-description`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsdoc-require-param-description.ts): require every `@param` tag with a name to include a description.
- [`jsdoc/require-param-name`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsdoc-require-param-name.ts): require every `@param` tag to include a parameter name.
- [`jsdoc/require-property-description`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsdoc-require-property-description.ts): require every `@property` tag with a name to include a description.
- [`jsdoc/require-property-name`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsdoc-require-property-name.ts): require every `@property` tag to include a property name.
- [`jsdoc/require-returns-description`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsdoc-require-returns-description.ts): require every `@returns` tag to include a description.
- [`jsdoc/tsdoc-syntax`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsdoc-tsdoc-syntax.ts): validate malformed TSDoc block tags and inline tags in `/** ... */` comments.

### Functional

Functional-programming policy rules. Push code toward immutability, side-effect-free expressions, and expression-style control flow. Most rules are useful in pieces — projects rarely enable the whole family at `"error"`. Enabling the whole set together expresses a strict functional-core / imperative-shell discipline. Diagnostic-only: `ttsc fix` does not rewrite mutation, classes, exceptions, loops, or branching into a functional design.

Source: [`eslint-plugin-functional`](https://github.com/eslint-functional/eslint-plugin-functional).

Recommended preset for projects committing to the discipline:

```ts
// lint.config.ts
export default {
  rules: {
    "functional/no-let": "error",
    "functional/no-loop-statements": "error",
    "functional/no-conditional-statements": "error",
    "functional/no-throw-statements": "error",
    "functional/no-try-statements": "error",
    "functional/no-classes": "error",
    "functional/immutable-data": "error",
    "functional/prefer-readonly-type": "error",
    "functional/type-declaration-immutability": ["error", {
      rules: [{ identifiers: ".*" }],
    }],
  },
} satisfies ITtscLintConfig;
```

- [`functional/functional-parameters`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/functional-functional-parameters.ts): rejects rest parameters, `arguments`, and optionally zero-parameter functions.
- [`functional/immutable-data`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/functional-immutable-data.ts): rejects writes through object/array members and mutable collection methods.
- [`functional/no-class-inheritance`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/functional-no-class-inheritance.ts): rejects class inheritance and abstract classes.
- [`functional/no-classes`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/functional-no-classes.ts): rejects class declarations and expressions.
- [`functional/no-conditional-statements`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/functional-no-conditional-statements.ts): rejects `if` and `switch` statements.
- [`functional/no-expression-statements`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/functional-no-expression-statements.ts): rejects expression statements used for side effects.
- [`functional/no-let`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/functional-no-let.ts): rejects `let` declarations.
- [`functional/no-loop-statements`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/functional-no-loop-statements.ts): rejects imperative loop statements.
- [`functional/no-mixed-types`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/functional-no-mixed-types.ts): rejects type/interface declarations that mix member shapes.
- [`functional/no-promise-reject`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/functional-no-promise-reject.ts): rejects `Promise.reject(...)`.
- [`functional/no-return-void`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/functional-no-return-void.ts): rejects void returns and void-returning declarations.
- [`functional/no-this-expressions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/functional-no-this-expressions.ts): rejects `this` expressions.
- [`functional/no-throw-statements`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/functional-no-throw-statements.ts): rejects `throw` statements.
- [`functional/no-try-statements`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/functional-no-try-statements.ts): rejects `try`/`catch`/`finally` statements.
- [`functional/prefer-immutable-types`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/functional-prefer-immutable-types.ts): prefers readonly/immutable type annotations.
- [`functional/prefer-property-signatures`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/functional-prefer-property-signatures.ts): prefers function-property signatures over method signatures.
- [`functional/prefer-readonly-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/functional-prefer-readonly-type.ts): requires readonly array, tuple, and property type syntax.
- [`functional/prefer-tacit`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/functional-prefer-tacit.ts): reports simple one-argument forwarding wrappers.
- [`functional/readonly-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/functional-readonly-type.ts): enforces the configured readonly type spelling.
- [`functional/type-declaration-immutability`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/functional-type-declaration-immutability.ts): requires matching type declarations to expose readonly member shapes.

### Architecture boundaries

Architecture-boundary rules enforce import direction and module visibility between configured source-path *elements* (layers, features, apps in a monorepo). Every rule operates on the *resolved source file* of an import — relative imports are followed to the real `.ts`/`.tsx`/`.d.ts` file before classification. Boundary diagnostics do not offer autofixes — a violation usually needs an API or architecture decision, not a mechanical import rewrite.

Source: ported from [`eslint-plugin-boundaries`](https://github.com/javierbrea/eslint-plugin-boundaries).

Example configuration:

```ts
// lint.config.ts
export default {
  rules: {
    "boundaries/element-types": ["error", {
      elements: [
        { type: "app", pattern: "src/app/**" },
        { type: "domain", pattern: "src/domain/**", entry: "index.ts", private: "internal/**" },
      ],
      rules: [{ from: "app", disallow: "domain" }],
    }],
    "boundaries/entry-point": ["error", {
      elements: [{ type: "domain", pattern: "src/domain/**", entry: "index.ts" }],
    }],
    "boundaries/no-private": ["error", {
      elements: [{ type: "domain", pattern: "src/domain/**", private: "internal/**" }],
    }],
    "boundaries/no-unknown": ["error", {
      elements: [
        { type: "app", pattern: "src/app/**" },
        { type: "domain", pattern: "src/domain/**" },
      ],
    }],
    "boundaries/external": ["error", { disallow: ["@legacy/sdk"] }],
  },
} satisfies ITtscLintConfig;
```

- [`boundaries/dependencies`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/boundaries-dependencies.ts): unified dependency-direction rule from upstream `eslint-plugin-boundaries`, intended to replace `element-types` / `entry-point` / `external` / `no-private` / `no-unknown` with a single policy block.
- [`boundaries/element-types`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/boundaries-element-types.ts): enforces allowed dependency directions between configured source-path element types.
- [`boundaries/entry-point`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/boundaries-entry-point.ts): requires imports into an element to target its configured public entry files.
- [`boundaries/external`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/boundaries-external.ts): restricts external package imports by package/specifier pattern.
- [`boundaries/no-private`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/boundaries-no-private.ts): rejects imports of configured private files from outside their element.
- [`boundaries/no-unknown`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/boundaries-no-unknown.ts): rejects relative imports whose resolved source file matches no configured element.

## Third-party rule plugins

Other npm packages can ship lint rules that compile into the same `@ttsc/lint` binary and report through the same diagnostic stream as built-ins. Declare them in `lint.config.ts`:

```ts
// lint.config.ts
import demoPlugin from "ttsc-lint-plugin-demo";
import type { ITtscLintConfig } from "@ttsc/lint";

export default {
  plugins: { demo: demoPlugin },
  rules: { "demo/no-todo-comment": "error" },
} satisfies ITtscLintConfig;
```

`ttsc` copies each declared contributor's Go source into a sub-package of `@ttsc/lint`'s module at build time, so the resulting binary has both built-in and contributor rules registered before `main`. Authoring instructions and the public Go API live in the [`@ttsc/lint` walkthrough → How a contributor package ships](https://ttsc.dev/docs/development/walkthroughs/lint#how-a-contributor-package-ships).

Contributor rules emit autofixes the same way built-ins do — call `ctx.ReportFix(node, message, edits...)` or `ctx.ReportRangeFix(pos, end, message, edits...)`. The `rule/astutil` package re-exports the byte-range helpers built-ins use (`NodeText`, `KeywordStart`, `FindKeyword`, `TokenRange`). See the [contributor autofix path](https://ttsc.dev/docs/development/walkthroughs/lint#the-contributor-autofix-path) section for the full contract and an example.

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `ttsc` development.

## References

`@ttsc/lint` ports the rule semantics from each of the following upstream projects. Each family in [Rules](#rules) cites its origin under a `Source:` line; this section is the consolidated index.

- [ESLint core rules](https://eslint.org/docs/latest/rules/)
- [`typescript-eslint`](https://github.com/typescript-eslint/typescript-eslint)
- [`eslint-plugin-react`](https://github.com/jsx-eslint/eslint-plugin-react)
- [`eslint-plugin-react-hooks`](https://github.com/facebook/react/tree/main/packages/eslint-plugin-react-hooks)
- [`eslint-plugin-react-refresh`](https://github.com/ArnaudBarre/eslint-plugin-react-refresh)
- [`eslint-plugin-react-perf`](https://github.com/cvazac/eslint-plugin-react-perf)
- [`eslint-plugin-jsx-a11y`](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y)
- [`@next/eslint-plugin-next`](https://github.com/vercel/next.js/tree/canary/packages/eslint-plugin-next)
- [`eslint-plugin-solid`](https://github.com/solidjs-community/eslint-plugin-solid)
- [`eslint-plugin-jest`](https://github.com/jest-community/eslint-plugin-jest)
- [`@vitest/eslint-plugin`](https://github.com/vitest-dev/eslint-plugin-vitest)
- [`eslint-plugin-testing-library`](https://github.com/testing-library/eslint-plugin-testing-library)
- [`eslint-plugin-playwright`](https://github.com/playwright-community/eslint-plugin-playwright)
- [`eslint-plugin-cypress`](https://github.com/cypress-io/eslint-plugin-cypress)
- [`eslint-plugin-storybook`](https://github.com/storybookjs/eslint-plugin-storybook)
- [`@tanstack/eslint-plugin-query`](https://github.com/TanStack/query/tree/main/packages/eslint-plugin-query)
- [`eslint-plugin-promise`](https://github.com/eslint-community/eslint-plugin-promise)
- [`eslint-plugin-regexp`](https://github.com/ota-meshi/eslint-plugin-regexp)
- [`eslint-plugin-security@4.0.0`](https://github.com/eslint-community/eslint-plugin-security)
- [`eslint-plugin-jsdoc`](https://github.com/gajus/eslint-plugin-jsdoc)
- [`eslint-plugin-tsdoc`](https://github.com/microsoft/tsdoc)
- [`eslint-plugin-functional`](https://github.com/eslint-functional/eslint-plugin-functional)
- [`eslint-plugin-boundaries`](https://github.com/javierbrea/eslint-plugin-boundaries)

### Claim ownership

To the maintainers of every plugin listed above: the rule semantics under `react/*`, `jest/*`, `playwright/*`, `tanstack-query/*`, `promise/*`, and the other family namespaces inside `@ttsc/lint` are a Go re-implementation of your work for the TypeScript-Go Checker. The intent is convenience — projects on `ttsc` get your rules without standing up a separate ESLint process — not ownership.

If you would prefer to publish a first-party `@ttsc/lint` plugin for your family yourself, you are welcome to take the Go sources under [`packages/lint/linthost/rules_*.go`](https://github.com/samchon/ttsc/tree/master/packages/lint/linthost) and the fixtures under [`tests/test-lint/src/cases/`](https://github.com/samchon/ttsc/tree/master/tests/test-lint/src/cases) and ship them as your own contributor plugin. Open an issue at [samchon/ttsc](https://github.com/samchon/ttsc/issues) when the upstream package is ready, and I will retire the in-tree port and add a redirect line under [Rules](#rules) pointing at your package. Same offer for partial coverage — name a subset and I will remove just those rules.

The contributor-plugin walkthrough is the [`@ttsc/lint` development guide](https://ttsc.dev/docs/development/walkthroughs/lint).

