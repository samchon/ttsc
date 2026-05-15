# `@ttsc/lint`

![banner of @ttsc/lint](https://raw.githubusercontent.com/samchon/ttsc/refs/heads/master/assets/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE)
[![NPM Version](https://img.shields.io/npm/v/@ttsc/lint.svg)](https://www.npmjs.com/package/@ttsc/lint)
[![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/lint.svg)](https://www.npmjs.com/package/@ttsc/lint)
[![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest)
[![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://github.com/samchon/ttsc/tree/master/docs)
[![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

Lint as compile errors.

Type errors and lint violations appear in one `ttsc` run.

## Demonstration

Given this file:

```typescript
// src/lint.ts
var x: number = 3;
let y: number = 4;
const z: string = 5;

console.log(x + y + z);
```

Run `ttsc` with `@ttsc/lint` enabled (see [Setup](#setup)):

```bash
$ pnpm ttsc
src/lint.ts:3:7 - error TS2322: Type 'number' is not assignable to type 'string'.

3 const z: string = 5;
        ~

src/lint.ts:2:5 - error TS17397: [prefer-const] Use const instead of let.

2 let y: number = 4;
      ~~~~~~~~~~~~~

src/lint.ts:1:1 - error TS11966: [no-var] Unexpected var, use let or const instead.

1 var x: number = 3;
  ~~~~~~~~~~~~~~~~~~

Found 3 errors in the same file, starting at: src/lint.ts:3
```

Type errors (`TS2322`) and lint violations (`TS17397`, `TS11966`) come out together, in the same `error TSxxxxx` shape.

CI that already runs `ttsc` blocks on lint with no extra wiring.

## Setup

Install `ttsc` and TypeScript-Go, then the lint plugin:

```bash
npm install -D ttsc @typescript/native-preview
npm install -D @ttsc/lint
```

Add `lint.config.ts`, or reuse an existing `eslint.config.ts`, next to your project config. If no config file or inline config is found, the compile fails.

```ts
// lint.config.ts
import type { TtscLintConfig } from "@ttsc/lint";

export default {
  "no-var": "error",
  "prefer-const": "error",
  "no-explicit-any": "warning",
  "no-console": "off",
} satisfies TtscLintConfig;
```

Use `compilerOptions.plugins` only when the project needs inline rules or an explicit config file path. Two ESLint-flat-config-shaped fields:

- `rules` — inline severity map applied to the project.
- `extends` — relative path to a standalone lint config file whose rules should be inherited.

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@ttsc/lint",
        "rules": {
          "no-var": "error",
          "prefer-const": "error",
          "no-explicit-any": "warning",
          "no-console": "off",
        },
      },
    ],
  },
}
```

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@ttsc/lint",
        "extends": "./lint.config.ts",
      },
    ],
  },
}
```

Then run your normal `ttsc` or `ttsx`:

```bash
npx ttsc
npx ttsx src/index.ts
```

- Lint errors fail the command.
- Under `ttsx`, lint errors stop the program before your entrypoint runs.
- Lint warnings are printed without changing the exit code.

### Fix

Run `ttsc fix` to apply supported autofixes and then run the same no-emit
typecheck + lint pass:

```bash
npx ttsc fix
# equivalent flag form
npx ttsc --fix
```

Native `@ttsc/lint` fixers currently cover:

- `no-var`, single-declaration `prefer-const`, and ESLint-safe `eqeqeq`
  cases (`typeof` comparisons and same-type literal comparisons).
- `no-wrapper-object-types` (rewrites `String`/`Number`/`Boolean`/`Symbol`/`BigInt`
  to the primitive form; `Object` stays detection-only).
- `prefer-as-const` (rewrites `value as "literal"` to `value as const`).
- `no-useless-rename` (drops `{ x as x }` / `{ x: x }` tails on
  import/export specifiers and binding elements).
- `object-shorthand` (`{ x: x }` → `{ x }`).
- `no-extra-non-null-assertion` (`a!!` → `a!`).
- `no-unnecessary-type-constraint` (drops ` extends any`/`unknown`).
- `prefer-namespace-keyword` (`module Foo {}` → `namespace Foo {}`).
- `no-useless-escape` (deletes redundant `\` inside string and regex
  literals; ASCII-only).
- `no-import-type-side-effects` (hoists inline `type` modifiers onto
  the import clause; emits multiple non-overlapping edits per finding —
  the canonical multi-edit fixer in the corpus).
- `await-thenable` (deletes `await` keyword when the operand is neither
  a Promise nor a thenable — first type-aware fixer).

When a supported `eslint.config.*` file runs through an installed ESLint runtime,
`ttsc fix` delegates to ESLint's own fixers and then reloads the TypeScript-Go
Program before reporting any remaining diagnostics.

`ttsc fix` is a one-shot project pass: it does not combine with `--watch`,
single-file mode, or `--emit`. The launcher rejects those combinations with an
explicit error. Applied fixes are written to disk before the recheck runs, so
source files stay modified even when `ttsc fix` exits non-zero on remaining
type errors or un-fixable lint violations.

Run `ttsc fix` locally, commit, then have CI run `ttsc --noEmit` to enforce
zero remaining errors.

### Config Files

By default, `@ttsc/lint` reads config files such as `lint.config.ts` or `eslint.config.ts` next to the selected `tsconfig.json`.

### Third-Party Rule Plugins

Third-party packages can contribute Go-implemented lint rules that compile into the same `@ttsc/lint` binary and report through the same diagnostic stream as the built-ins. Two declaration surfaces:

```jsonc
// tsconfig.json — inline declaration
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@ttsc/lint",
        "plugins": { "demo": "ttsc-lint-plugin-demo" },
        "rules": { "demo/no-todo-comment": "error" },
      },
    ],
  },
}
```

```ts
// lint.config.ts — ESLint flat-config style
import demoPlugin from "ttsc-lint-plugin-demo";
import { defineConfig } from "@ttsc/lint";

export default defineConfig([
  {
    plugins: { demo: demoPlugin },
    rules: { "demo/no-todo-comment": "error" },
  },
]);
```

ttsc copies each declared contributor's Go source into a sub-package of `@ttsc/lint`'s module at build time, so the resulting binary has both built-in and contributor rules registered before `main`. Authoring instructions and the public Go API live in [`docs/10-reference-plugins.md`](https://github.com/samchon/ttsc/blob/master/docs/10-reference-plugins.md#authoring-a-lint-rule-contributor).

Contributor rules emit autofixes the same way built-ins do — call `ctx.ReportFix(node, message, edits...)` or `ctx.ReportRangeFix(pos, end, message, edits...)`. The `rule/astutil` package re-exports the byte-range helpers built-ins use (`NodeText`, `KeywordStart`, `FindKeyword`, `TokenRange`). See the [Emitting Autofixes](https://github.com/samchon/ttsc/blob/master/docs/10-reference-plugins.md#emitting-autofixes) section for the full contract and an example.

## Scope

No bundled recommended preset yet. Rules remain off until you enable them.

## Rules

Rules are off until you enable them:

```jsonc
{
  "no-var": "error",
  "eqeqeq": "error",
  "prefer-template": "warning",
  "no-non-null-assertion": "off",
}
```

Rule severities are `"error"`, `"warning"`, and `"off"`.

The rule corpus is tested in `tests/test-lint/src/cases/*.ts`, which is the best place to check the exact patterns currently covered. Each rule below links to its tested fixture:

- [`adjacent-overload-signatures`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/adjacent-overload-signatures.ts): keeps overload declarations for the same member adjacent.
- [`array-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/array-type.ts): prefers `T[]` and `readonly T[]` over array helper types.
- [`await-thenable`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/await-thenable.ts): rejects `await` on a value that is neither a Promise nor a thenable (type-aware).
- [`ban-ts-comment`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/ban-ts-comment.ts): rejects TypeScript suppression comments such as `@ts-ignore`.
- [`ban-tslint-comment`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/ban-tslint-comment.ts): rejects obsolete `tslint:` comments.
- [`consistent-indexed-object-style`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/consistent-indexed-object-style.ts): prefers `Record` for single index-signature object types.
- [`consistent-type-assertions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/consistent-type-assertions.ts): prefers `as` type assertions over angle-bracket assertions.
- [`consistent-type-definitions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/consistent-type-definitions.ts): prefers interfaces for object-shaped type definitions.
- [`consistent-type-imports`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/consistent-type-imports/violation.ts): uses `import type` when imported names are type-only.
- [`default-param-last`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/default-param-last.ts): keeps parameters with default values at the end of the list.
- [`dot-notation`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/dot-notation.ts): prefers dot property access when a string-literal key is a valid identifier.
- [`eqeqeq`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/eqeqeq.ts): requires strict equality operators.
- [`for-direction`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/for-direction.ts): catches loop counters updated in the wrong direction.
- [`no-alert`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-alert.ts): rejects `alert`, `confirm`, and `prompt`.
- [`no-array-constructor`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-array-constructor.ts): rejects `Array` constructor calls.
- [`no-array-delete`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-array-delete.ts): rejects `delete` on array elements.
- [`no-async-promise-executor`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-async-promise-executor.ts): rejects async Promise executors.
- [`no-bitwise`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-bitwise.ts): rejects bitwise operators.
- [`no-caller`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-caller.ts): rejects `arguments.caller` and `arguments.callee`.
- [`no-case-declarations`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-case-declarations.ts): rejects lexical declarations directly inside `case` clauses.
- [`no-class-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-class-assign.ts): rejects reassignment of class declarations.
- [`no-compare-neg-zero`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-compare-neg-zero.ts): rejects comparisons against `-0`.
- [`no-cond-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-cond-assign.ts): rejects assignments inside conditions.
- [`no-confusing-non-null-assertion`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-confusing-non-null-assertion.ts): rejects confusing non-null assertions next to equality checks.
- [`no-console`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-console.ts): rejects `console` calls.
- [`no-constant-condition`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-constant-condition.ts): rejects constant conditions.
- [`no-continue`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-continue.ts): rejects `continue` statements.
- [`no-control-regex`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-control-regex.ts): rejects control characters in regular expressions.
- [`no-debugger`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-debugger.ts): rejects `debugger` statements.
- [`no-delete-var`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-delete-var.ts): rejects deleting variables.
- [`no-dupe-args`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-dupe-args.ts): rejects duplicate function parameters.
- [`no-dupe-else-if`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-dupe-else-if.ts): rejects repeated `else if` conditions.
- [`no-dupe-keys`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-dupe-keys.ts): rejects duplicate object keys.
- [`no-duplicate-case`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-duplicate-case.ts): rejects duplicate `switch` case labels.
- [`no-duplicate-enum-values`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-duplicate-enum-values.ts): rejects duplicate enum member values.
- [`no-dynamic-delete`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-dynamic-delete.ts): rejects `delete` on dynamically computed property keys.
- [`no-empty`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty.ts): rejects empty blocks.
- [`no-empty-character-class`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-character-class.ts): rejects empty regex character classes.
- [`no-empty-function`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-function.ts): rejects empty functions.
- [`no-empty-interface`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-interface.ts): rejects empty interfaces.
- [`no-empty-object-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-object-type.ts): rejects empty object type literals.
- [`no-empty-pattern`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-pattern.ts): rejects empty destructuring patterns.
- [`no-empty-static-block`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-static-block.ts): rejects empty class static blocks.
- [`no-eq-null`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-eq-null.ts): rejects loose null comparisons.
- [`no-eval`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-eval.ts): rejects `eval`.
- [`no-ex-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-ex-assign.ts): rejects reassignment of caught exceptions.
- [`no-explicit-any`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-explicit-any.ts): rejects explicit `any`.
- [`no-extra-bind`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-extra-bind.ts): rejects unnecessary `.bind()` calls.
- [`no-extra-boolean-cast`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-extra-boolean-cast.ts): rejects redundant boolean casts.
- [`no-extra-non-null-assertion`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-extra-non-null-assertion.ts): rejects repeated non-null assertions.
- [`no-fallthrough`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-fallthrough.ts): rejects unmarked `switch` fallthrough.
- [`no-func-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-func-assign.ts): rejects reassignment of function declarations.
- [`no-import-type-side-effects`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-import-type-side-effects/violation.ts): hoists inline `type` modifiers into a single `import type` declaration.
- [`no-inferrable-types`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-inferrable-types.ts): rejects type annotations TypeScript can infer.
- [`no-inner-declarations`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-inner-declarations.ts): rejects function declarations nested in blocks.
- [`no-irregular-whitespace`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-irregular-whitespace.ts): rejects irregular whitespace.
- [`no-iterator`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-iterator.ts): rejects `__iterator__`.
- [`no-labels`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-labels.ts): rejects labels.
- [`no-lone-blocks`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-lone-blocks.ts): rejects unnecessary standalone blocks.
- [`no-lonely-if`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-lonely-if.ts): rejects `if` as the only statement in an `else`.
- [`no-loss-of-precision`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-loss-of-precision.ts): rejects number literals that lose precision.
- [`no-misleading-character-class`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-misleading-character-class.ts): rejects misleading regex character classes.
- [`no-misused-new`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-misused-new.ts): rejects constructor-like signatures in interfaces.
- [`no-mixed-enums`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-mixed-enums.ts): rejects enums that mix numeric and string members.
- [`no-multi-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-multi-assign.ts): rejects chained assignments.
- [`no-multi-str`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-multi-str.ts): rejects multiline string escapes.
- [`no-namespace`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-namespace.ts): rejects non-ambient namespaces.
- [`no-negated-condition`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-negated-condition.ts): rejects negated conditions with an `else`.
- [`no-nested-ternary`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-nested-ternary.ts): rejects nested ternary expressions.
- [`no-new`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-new.ts): rejects `new` expressions used only for side effects.
- [`no-new-func`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-new-func.ts): rejects `Function` constructors.
- [`no-new-wrappers`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-new-wrappers.ts): rejects primitive wrapper constructors.
- [`no-non-null-asserted-nullish-coalescing`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-non-null-asserted-nullish-coalescing.ts): rejects non-null assertions next to `??`.
- [`no-non-null-asserted-optional-chain`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-non-null-asserted-optional-chain.ts): rejects non-null assertions on optional chains.
- [`no-non-null-assertion`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-non-null-assertion.ts): rejects postfix non-null assertions.
- [`no-obj-calls`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-obj-calls.ts): rejects calling global objects as functions.
- [`no-object-constructor`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-object-constructor.ts): rejects `new Object()`.
- [`no-octal`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-octal.ts): rejects legacy octal literals.
- [`no-octal-escape`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-octal-escape.ts): rejects octal escape sequences.
- [`no-plusplus`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-plusplus.ts): rejects `++` and `--`.
- [`no-promise-executor-return`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-promise-executor-return.ts): rejects returned values from Promise executors.
- [`no-proto`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-proto.ts): rejects `__proto__`.
- [`no-prototype-builtins`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-prototype-builtins.ts): rejects direct `Object.prototype` method calls.
- [`no-regex-spaces`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-regex-spaces.ts): rejects repeated literal spaces in regexes.
- [`no-require-imports`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-require-imports.ts): rejects CommonJS `require` imports.
- [`no-return-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-return-assign.ts): rejects assignments in `return`.
- [`no-script-url`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-script-url.ts): rejects `javascript:` URLs.
- [`no-self-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-self-assign.ts): rejects assignments to the same value.
- [`no-self-compare`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-self-compare.ts): rejects comparing a value to itself.
- [`no-sequences`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-sequences.ts): rejects comma expressions.
- [`no-setter-return`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-setter-return.ts): rejects returned values from setters.
- [`no-shadow-restricted-names`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-shadow-restricted-names.ts): rejects shadowing restricted globals.
- [`no-sparse-arrays`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-sparse-arrays.ts): rejects sparse arrays.
- [`no-template-curly-in-string`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-template-curly-in-string.ts): rejects `${...}` text inside normal strings.
- [`no-this-alias`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-this-alias.ts): rejects aliasing `this` to locals.
- [`no-throw-literal`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-throw-literal.ts): rejects throwing literals.
- [`no-undef-init`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-undef-init.ts): rejects initializing to `undefined`.
- [`no-undefined`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-undefined.ts): rejects the global `undefined` identifier.
- [`no-unnecessary-type-constraint`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unnecessary-type-constraint.ts): rejects redundant `extends any` and `extends unknown` constraints.
- [`no-unneeded-ternary`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unneeded-ternary.ts): rejects redundant ternary expressions.
- [`no-unsafe-declaration-merging`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unsafe-declaration-merging.ts): rejects unsafe class/interface declaration merging.
- [`no-unsafe-finally`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unsafe-finally.ts): rejects control flow from `finally`.
- [`no-unsafe-function-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unsafe-function-type.ts): rejects the unsafe `Function` type.
- [`no-unsafe-negation`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unsafe-negation.ts): rejects unsafe negation before relational checks.
- [`no-unused-expressions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unused-expressions.ts): rejects expression statements with no effect.
- [`no-unused-labels`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unused-labels.ts): rejects labels that no `break` or `continue` targets.
- [`no-useless-call`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-call.ts): rejects unnecessary `.call()` and `.apply()`.
- [`no-useless-catch`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-catch.ts): rejects catch blocks that only rethrow.
- [`no-useless-computed-key`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-computed-key.ts): rejects unnecessary computed property keys.
- [`no-useless-concat`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-concat.ts): rejects unnecessary string concatenation.
- [`no-useless-constructor`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-constructor.ts): rejects empty constructors with no parameters.
- [`no-useless-escape`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-escape.ts): rejects backslash escapes that have no effect inside strings or regexes.
- [`no-useless-rename`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-rename.ts): rejects import/export/destructure renames to the same name.
- [`no-var`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-var.ts): rejects `var`.
- [`no-with`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-with.ts): rejects `with` statements.
- [`no-wrapper-object-types`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-wrapper-object-types.ts): rejects boxed object type names such as `String` and `Boolean`.
- [`object-shorthand`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/object-shorthand.ts): requires object property shorthand where possible.
- [`operator-assignment`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/operator-assignment.ts): prefers compound assignment operators.
- [`prefer-as-const`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-as-const.ts): prefers `as const` for literal assertions.
- [`prefer-const`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-const.ts): prefers `const` for `let` bindings that are never reassigned.
- [`prefer-enum-initializers`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-enum-initializers.ts): requires explicit enum member initializers.
- [`prefer-exponentiation-operator`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-exponentiation-operator.ts): prefers `**` over `Math.pow`.
- [`prefer-for-of`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-for-of.ts): prefers `for...of` for simple array iteration.
- [`prefer-function-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-function-type.ts): prefers function type aliases over single-call interfaces.
- [`prefer-literal-enum-member`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-literal-enum-member.ts): prefers literal enum member initializers over computed expressions.
- [`prefer-namespace-keyword`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-namespace-keyword.ts): prefers `namespace` over TypeScript's legacy `module` keyword.
- [`prefer-spread`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-spread.ts): prefers spread arguments over `.apply`.
- [`prefer-template`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-template.ts): prefers template literals over string concatenation.
- [`radix`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/radix.ts): requires a radix argument for `parseInt`.
- [`require-yield`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/require-yield.ts): requires generator functions to contain `yield`.
- [`triple-slash-reference`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/triple-slash-reference/violation.ts): rejects triple-slash reference directives.
- [`use-isnan`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/use-isnan.ts): requires `Number.isNaN`/`isNaN` for `NaN` checks.
- [`valid-typeof`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/valid-typeof.ts): restricts `typeof` comparisons to valid strings.
- [`vars-on-top`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/vars-on-top.ts): requires `var` declarations at the top of their scope.
- [`yoda`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/yoda.ts): rejects literal-first comparisons.

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `ttsc` development.
