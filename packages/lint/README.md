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

Source: [ESLint core rules](https://eslint.org/docs/latest/rules/) (MIT).

- [`default-param-last`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/default-param-last.ts) — keeps parameters with default values at the end of the list.
- [`dot-notation`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/dot-notation.ts) — prefers dot property access when a string-literal key is a valid identifier.
- [`eqeqeq`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/eqeqeq.ts) — requires strict equality operators.
- [`for-direction`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/for-direction.ts) — catches loop counters updated in the wrong direction.
- [`no-alert`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-alert.ts) — rejects `alert`, `confirm`, and `prompt`.
- [`no-array-constructor`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-array-constructor.ts) — rejects `Array` constructor calls.
- [`no-async-promise-executor`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-async-promise-executor.ts) — rejects async Promise executors.
- [`no-bitwise`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-bitwise.ts) — rejects bitwise operators.
- [`no-caller`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-caller.ts) — rejects `arguments.caller` and `arguments.callee`.
- [`no-case-declarations`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-case-declarations.ts) — rejects lexical declarations directly inside `case` clauses.
- [`no-class-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-class-assign.ts) — rejects reassignment of class declarations.
- [`no-compare-neg-zero`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-compare-neg-zero.ts) — rejects comparisons against `-0`.
- [`no-cond-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-cond-assign.ts) — rejects assignments inside conditions.
- [`no-console`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-console.ts) — rejects `console` calls.
- [`no-constant-condition`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-constant-condition.ts) — rejects constant conditions.
- [`no-continue`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-continue.ts) — rejects `continue` statements.
- [`no-control-regex`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-control-regex.ts) — rejects control characters in regular expressions.
- [`no-debugger`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-debugger.ts) — rejects `debugger` statements.
- [`no-delete-var`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-delete-var.ts) — rejects deleting variables.
- [`no-dupe-args`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-dupe-args.ts) — rejects duplicate function parameters.
- [`no-dupe-else-if`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-dupe-else-if.ts) — rejects repeated `else if` conditions.
- [`no-dupe-keys`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-dupe-keys.ts) — rejects duplicate object keys.
- [`no-duplicate-case`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-duplicate-case.ts) — rejects duplicate `switch` case labels.
- [`no-empty`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty.ts) — rejects empty blocks.
- [`no-empty-character-class`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-character-class.ts) — rejects empty regex character classes.
- [`no-empty-function`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-function.ts) — rejects empty functions.
- [`no-empty-pattern`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-pattern.ts) — rejects empty destructuring patterns.
- [`no-empty-static-block`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-static-block.ts) — rejects empty class static blocks.
- [`no-eq-null`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-eq-null.ts) — rejects loose null comparisons.
- [`no-eval`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-eval.ts) — rejects `eval`.
- [`no-ex-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-ex-assign.ts) — rejects reassignment of caught exceptions.
- [`no-extra-bind`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-extra-bind.ts) — rejects unnecessary `.bind()` calls.
- [`no-extra-boolean-cast`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-extra-boolean-cast.ts) — rejects redundant boolean casts.
- [`no-fallthrough`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-fallthrough.ts) — rejects unmarked `switch` fallthrough.
- [`no-func-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-func-assign.ts) — rejects reassignment of function declarations.
- [`no-inner-declarations`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-inner-declarations.ts) — rejects function declarations nested in blocks.
- [`no-irregular-whitespace`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-irregular-whitespace.ts) — rejects irregular whitespace.
- [`no-iterator`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-iterator.ts) — rejects `__iterator__`.
- [`no-labels`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-labels.ts) — rejects labels.
- [`no-lone-blocks`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-lone-blocks.ts) — rejects unnecessary standalone blocks.
- [`no-lonely-if`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-lonely-if.ts) — rejects `if` as the only statement in an `else`.
- [`no-loss-of-precision`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-loss-of-precision.ts) — rejects number literals that lose precision.
- [`no-misleading-character-class`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-misleading-character-class.ts) — rejects misleading regex character classes.
- [`no-multi-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-multi-assign.ts) — rejects chained assignments.
- [`no-multi-str`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-multi-str.ts) — rejects multiline string escapes.
- [`no-negated-condition`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-negated-condition.ts) — rejects negated conditions with an `else`.
- [`no-nested-ternary`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-nested-ternary.ts) — rejects nested ternary expressions.
- [`no-new`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-new.ts) — rejects `new` expressions used only for side effects.
- [`no-new-func`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-new-func.ts) — rejects `Function` constructors.
- [`no-new-wrappers`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-new-wrappers.ts) — rejects primitive wrapper constructors.
- [`no-obj-calls`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-obj-calls.ts) — rejects calling global objects as functions.
- [`no-object-constructor`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-object-constructor.ts) — rejects `new Object()`.
- [`no-octal`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-octal.ts) — rejects legacy octal literals.
- [`no-octal-escape`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-octal-escape.ts) — rejects octal escape sequences.
- [`no-plusplus`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-plusplus.ts) — rejects `++` and `--`.
- [`no-promise-executor-return`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-promise-executor-return.ts) — rejects returned values from Promise executors.
- [`no-proto`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-proto.ts) — rejects `__proto__`.
- [`no-prototype-builtins`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-prototype-builtins.ts) — rejects direct `Object.prototype` method calls.
- [`no-regex-spaces`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-regex-spaces.ts) — rejects repeated literal spaces in regexes.
- [`no-return-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-return-assign.ts) — rejects assignments in `return`.
- [`no-script-url`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-script-url.ts) — rejects `javascript:` URLs.
- [`no-self-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-self-assign.ts) — rejects assignments to the same value.
- [`no-self-compare`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-self-compare.ts) — rejects comparing a value to itself.
- [`no-sequences`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-sequences.ts) — rejects comma expressions.
- [`no-setter-return`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-setter-return.ts) — rejects returned values from setters.
- [`no-shadow-restricted-names`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-shadow-restricted-names.ts) — rejects shadowing restricted globals.
- [`no-sparse-arrays`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-sparse-arrays.ts) — rejects sparse arrays.
- [`no-template-curly-in-string`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-template-curly-in-string.ts) — rejects `${...}` text inside normal strings.
- [`no-throw-literal`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-throw-literal.ts) — rejects throwing literals.
- [`no-undef-init`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-undef-init.ts) — rejects initializing to `undefined`.
- [`no-undefined`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-undefined.ts) — rejects the global `undefined` identifier.
- [`no-unneeded-ternary`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unneeded-ternary.ts) — rejects redundant ternary expressions.
- [`no-unsafe-finally`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unsafe-finally.ts) — rejects control flow from `finally`.
- [`no-unsafe-negation`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unsafe-negation.ts) — rejects unsafe negation before relational checks.
- [`no-unused-expressions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unused-expressions.ts) — rejects expression statements with no effect.
- [`no-unused-labels`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unused-labels.ts) — rejects labels that no `break` or `continue` targets.
- [`no-useless-call`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-call.ts) — rejects unnecessary `.call()` and `.apply()`.
- [`no-useless-catch`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-catch.ts) — rejects catch blocks that only rethrow.
- [`no-useless-computed-key`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-computed-key.ts) — rejects unnecessary computed property keys.
- [`no-useless-concat`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-concat.ts) — rejects unnecessary string concatenation.
- [`no-useless-constructor`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-constructor.ts) — rejects empty constructors with no parameters.
- [`no-useless-escape`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-escape.ts) — rejects backslash escapes that have no effect inside strings or regexes.
- [`no-useless-rename`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-rename.ts) — rejects import/export/destructure renames to the same name.
- [`no-var`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-var.ts) — rejects `var`.
- [`no-with`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-with.ts) — rejects `with` statements.
- [`object-shorthand`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/object-shorthand.ts) — requires object property shorthand where possible.
- [`operator-assignment`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/operator-assignment.ts) — prefers compound assignment operators.
- [`prefer-const`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-const.ts) — prefers `const` for `let` bindings that are never reassigned.
- [`prefer-exponentiation-operator`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-exponentiation-operator.ts) — prefers `**` over `Math.pow`.
- [`prefer-for-of`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-for-of.ts) — prefers `for...of` for simple array iteration.
- [`prefer-spread`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-spread.ts) — prefers spread arguments over `.apply`.
- [`prefer-template`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-template.ts) — prefers template literals over string concatenation.
- [`radix`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/radix.ts) — requires a radix argument for `parseInt`.
- [`require-yield`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/require-yield.ts) — requires generator functions to contain `yield`.
- [`use-isnan`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/use-isnan.ts) — requires `Number.isNaN`/`isNaN` for `NaN` checks.
- [`valid-typeof`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/valid-typeof.ts) — restricts `typeof` comparisons to valid strings.
- [`vars-on-top`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/vars-on-top.ts) — requires `var` declarations at the top of their scope.
- [`yoda`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/yoda.ts) — rejects literal-first comparisons.

### TypeScript

TypeScript-only rules and `@typescript-eslint` plugin equivalents, exposed under the `typescript/*` namespace. Each rule either requires TypeScript syntax (interface, `enum`, `namespace`, `as`, `!`, `import type`, type parameters, declaration merging, parameter properties, triple-slash references) or originates from `@typescript-eslint` as a TS-aware extension that has no counterpart in plain ESLint.

Source: [`typescript-eslint`](https://github.com/typescript-eslint/typescript-eslint) (MIT).

- [`typescript/adjacent-overload-signatures`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/adjacent-overload-signatures.ts) — keeps overload declarations for the same member adjacent.
- [`typescript/array-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/array-type.ts) — prefers `T[]` and `readonly T[]` over array helper types.
- [`typescript/await-thenable`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/await-thenable.ts) — rejects `await` on a value that is neither a Promise nor a thenable (type-aware).
- [`typescript/ban-ts-comment`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/ban-ts-comment.ts) — rejects TypeScript suppression comments such as `@ts-ignore`.
- [`typescript/ban-tslint-comment`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/ban-tslint-comment.ts) — rejects obsolete `tslint:` comments.
- [`typescript/consistent-indexed-object-style`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/consistent-indexed-object-style.ts) — prefers `Record` for single index-signature object types.
- [`typescript/consistent-type-assertions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/consistent-type-assertions.ts) — prefers `as` type assertions over angle-bracket assertions.
- [`typescript/consistent-type-definitions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/consistent-type-definitions.ts) — prefers interfaces for object-shaped type definitions.
- [`typescript/consistent-type-imports`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/consistent-type-imports/violation.ts) — uses `import type` when imported names are type-only.
- [`typescript/method-signature-style`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/method-signature-style.ts) — prefers function-property signatures over method shorthand signatures.
- [`typescript/no-array-delete`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-array-delete.ts) — rejects `delete` on array elements.
- [`typescript/no-confusing-non-null-assertion`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-confusing-non-null-assertion.ts) — rejects confusing non-null assertions next to equality checks.
- [`typescript/no-duplicate-enum-values`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-duplicate-enum-values.ts) — rejects duplicate enum member values.
- [`typescript/no-dynamic-delete`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-dynamic-delete.ts) — rejects `delete` on dynamically computed property keys.
- [`typescript/no-empty-interface`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-interface.ts) — rejects empty interfaces.
- [`typescript/no-empty-object-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-object-type.ts) — rejects empty object type literals.
- [`typescript/no-explicit-any`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-explicit-any.ts) — rejects explicit `any`.
- [`typescript/no-extra-non-null-assertion`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-extra-non-null-assertion.ts) — rejects repeated non-null assertions.
- [`typescript/no-import-type-side-effects`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-import-type-side-effects/violation.ts) — hoists inline `type` modifiers into a single `import type` declaration.
- [`typescript/no-inferrable-types`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-inferrable-types.ts) — rejects type annotations TypeScript can infer.
- [`typescript/no-misused-new`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-misused-new.ts) — rejects constructor-like signatures in interfaces.
- [`typescript/no-mixed-enums`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-mixed-enums.ts) — rejects enums that mix numeric and string members.
- [`typescript/no-namespace`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-namespace.ts) — rejects non-ambient namespaces.
- [`typescript/no-non-null-asserted-nullish-coalescing`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-non-null-asserted-nullish-coalescing.ts) — rejects non-null assertions next to `??`.
- [`typescript/no-non-null-asserted-optional-chain`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-non-null-asserted-optional-chain.ts) — rejects non-null assertions on optional chains.
- [`typescript/no-non-null-assertion`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-non-null-assertion.ts) — rejects postfix non-null assertions.
- [`typescript/no-require-imports`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-require-imports.ts) — rejects CommonJS `require` imports.
- [`typescript/no-this-alias`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-this-alias.ts) — rejects aliasing `this` to locals.
- [`typescript/no-unnecessary-parameter-property-assignment`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unnecessary-parameter-property-assignment.ts) — rejects constructor assignments already handled by parameter properties.
- [`typescript/no-unnecessary-type-constraint`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unnecessary-type-constraint.ts) — rejects redundant `extends any` and `extends unknown` constraints.
- [`typescript/no-unsafe-declaration-merging`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unsafe-declaration-merging.ts) — rejects unsafe class/interface declaration merging.
- [`typescript/no-unsafe-function-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unsafe-function-type.ts) — rejects the unsafe `Function` type.
- [`typescript/no-useless-empty-export`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-empty-export.ts) — rejects redundant empty `export {}` declarations in module files.
- [`typescript/no-wrapper-object-types`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-wrapper-object-types.ts) — rejects boxed object type names such as `String` and `Boolean`.
- [`typescript/prefer-as-const`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-as-const.ts) — prefers `as const` for literal assertions.
- [`typescript/prefer-enum-initializers`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-enum-initializers.ts) — requires explicit enum member initializers.
- [`typescript/prefer-function-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-function-type.ts) — prefers function type aliases over single-call interfaces.
- [`typescript/prefer-literal-enum-member`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-literal-enum-member.ts) — prefers literal enum member initializers over computed expressions.
- [`typescript/prefer-namespace-keyword`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-namespace-keyword.ts) — prefers `namespace` over TypeScript's legacy `module` keyword.
- [`typescript/triple-slash-reference`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/triple-slash-reference/violation.ts) — rejects triple-slash reference directives.

### React

React TSX rules — Hooks correctness, JSX safety, the React Compiler subset, and Fast Refresh export shape. Bundles rules from three upstream plugins under one `react/*` namespace, matching Oxlint's layout. Performance-only rules live in [React performance](#react-performance) because they are opt-in toggles rather than correctness checks.

Source: [`eslint-plugin-react`](https://github.com/jsx-eslint/eslint-plugin-react) (MIT), [`eslint-plugin-react-hooks`](https://github.com/facebook/react/tree/main/packages/eslint-plugin-react-hooks) (MIT), [`eslint-plugin-react-refresh`](https://github.com/ArnaudBarre/eslint-plugin-react-refresh) (MIT).

- [`react/button-has-type`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react/react_button_has_type_requires_explicit_type_test.go) — requires explicit valid `type` values on JSX `button` elements.
- [`react/component-hook-factories`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react/react_compiler_subset_reports_local_purity_violations_test.go) — rejects nested component or Hook factories that call Hooks.
- [`react/exhaustive-deps`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react/react_exhaustive_deps_reports_missing_identifiers_test.go) — reports high-confidence missing identifier dependencies in `useEffect`, `useLayoutEffect`, `useInsertionEffect`, `useMemo`, and `useCallback`.
- [`react/iframe-missing-sandbox`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react/react_iframe_missing_sandbox_reports_iframe_test.go) — requires JSX `iframe` elements to include a sandbox attribute.
- [`react/immutability`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react/react_compiler_subset_reports_local_purity_violations_test.go) — rejects local prop mutation inside components and Hooks.
- [`react/jsx-key`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react/react_jsx_key_reports_array_element_test.go) — requires `key` props for JSX elements produced by arrays or `.map()`.
- [`react/jsx-no-duplicate-props`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react/react_jsx_no_duplicate_props_reports_duplicate_test.go) — rejects duplicate JSX prop names on the same element.
- [`react/jsx-no-script-url`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react/react_jsx_no_script_url_reports_javascript_href_test.go) — rejects `javascript:` URLs in JSX URL-like props.
- [`react/no-array-index-key`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react/react_no_array_index_key_reports_index_key_test.go) — rejects array map index parameters as JSX keys.
- [`react/no-children-prop`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react/react_no_children_prop_reports_children_prop_test.go) — rejects passing children through a JSX `children` prop.
- [`react/no-danger`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react/react_no_danger_reports_dangerously_set_inner_html_test.go) — rejects `dangerouslySetInnerHTML`.
- [`react/no-danger-with-children`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react/react_no_danger_with_children_reports_mixed_content_test.go) — rejects combining `dangerouslySetInnerHTML` with children.
- [`react/no-direct-mutation-state`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react/react_no_direct_mutation_state_reports_state_property_write_test.go) — rejects direct writes to `this.state` outside constructor initialization.
- [`react/no-find-dom-node`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react/react_no_find_dom_node_reports_call_test.go) — rejects `findDOMNode` calls.
- [`react/no-is-mounted`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react/react_no_is_mounted_reports_call_test.go) — rejects `isMounted` calls.
- [`react/no-string-refs`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react/react_no_string_refs_reports_string_ref_test.go) — rejects string JSX refs.
- [`react/no-unescaped-entities`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react/react_no_unescaped_entities_reports_quote_text_test.go) — rejects unescaped `>`, `"`, `'`, and `}` in JSX text.
- [`react/only-export-components`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react/only_export_components_reports_non_component_export_test.go) — keeps React Fast Refresh component modules from exporting non-components.
- [`react/refs`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react/react_compiler_subset_reports_local_purity_violations_test.go) — rejects reading or writing `ref.current` during render.
- [`react/rules-of-hooks`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react/react_rules_of_hooks_rejects_invalid_call_sites_test.go) — rejects Hooks called outside components or custom Hooks, in nested callbacks, or in conditional/loop control flow.
- [`react/set-state-in-effect`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react/react_state_setters_reject_render_and_effect_calls_test.go) — rejects synchronous setter calls inside `useEffect`.
- [`react/set-state-in-render`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react/react_state_setters_reject_render_and_effect_calls_test.go) — rejects `useState` / `useReducer` setters called during render.
- [`react/style-prop-object`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react/react_style_prop_object_reports_string_style_test.go) — rejects string literal JSX `style` prop values.
- [`react/use-memo`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react/react_compiler_subset_reports_local_purity_violations_test.go) — rejects block-bodied `useMemo` callbacks that do not return a value.
- [`react/void-dom-elements-no-children`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react/react_void_dom_elements_no_children_reports_img_child_test.go) — rejects children and HTML injection props on void DOM elements.

### React performance

Detects freshly-allocated reference values (arrays, objects, functions, JSX elements) passed as JSX props. A new reference invalidates `React.memo` / `useMemo` shallow checks on every render. Useful for performance-critical render paths; usually unnecessary for top-level pages. Diagnostics only fire on `.tsx` source files — JSX heuristics rely on the file extension, so `.ts` files are skipped even when they contain JSX-like syntax.

Source: [`eslint-plugin-react-perf`](https://github.com/cvazac/eslint-plugin-react-perf) (MIT).

- [`react-perf/jsx-no-jsx-as-prop`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react-perf/react_perf_jsx_no_jsx_as_prop_test.go) — rejects freshly-created JSX elements or fragments passed as JSX props.
- [`react-perf/jsx-no-new-array-as-prop`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react-perf/react_perf_jsx_no_new_array_as_prop_test.go) — rejects freshly-created arrays passed as JSX props.
- [`react-perf/jsx-no-new-function-as-prop`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react-perf/react_perf_jsx_no_new_function_as_prop_test.go) — rejects freshly-created functions passed as JSX props.
- [`react-perf/jsx-no-new-object-as-prop`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react-perf/react_perf_jsx_no_new_object_as_prop_test.go) — rejects freshly-created objects passed as JSX props.

### JSX accessibility

JSX accessibility rules applied to TSX (and JSX-in-TS) sources. Checks the static structure of JSX elements against WAI-ARIA authoring guidance — interactive controls should be focusable, labels should reference a control, ARIA properties should match the element role, and so on. Runtime accessibility issues require live audits; this family catches the statically-decidable subset. Component alias settings, router-specific anchor settings, and autofixes are deferred.

Source: [`eslint-plugin-jsx-a11y`](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y) (MIT).

`jsx-a11y/alt-text`, `jsx-a11y/anchor-has-content`, `jsx-a11y/anchor-is-valid`, `jsx-a11y/aria-activedescendant-has-tabindex`, `jsx-a11y/aria-props`, `jsx-a11y/aria-proptypes`, `jsx-a11y/aria-role`, `jsx-a11y/aria-unsupported-elements`, `jsx-a11y/autocomplete-valid`, `jsx-a11y/click-events-have-key-events`, `jsx-a11y/control-has-associated-label`, `jsx-a11y/heading-has-content`, `jsx-a11y/html-has-lang`, `jsx-a11y/iframe-has-title`, `jsx-a11y/img-redundant-alt`, `jsx-a11y/interactive-supports-focus`, `jsx-a11y/label-has-associated-control`, `jsx-a11y/label-has-for`, `jsx-a11y/lang`, `jsx-a11y/media-has-caption`, `jsx-a11y/mouse-events-have-key-events`, `jsx-a11y/no-access-key`, `jsx-a11y/no-aria-hidden-on-focusable`, `jsx-a11y/no-autofocus`, `jsx-a11y/no-distracting-elements`, `jsx-a11y/no-interactive-element-to-noninteractive-role`, `jsx-a11y/no-noninteractive-element-interactions`, `jsx-a11y/no-noninteractive-element-to-interactive-role`, `jsx-a11y/no-noninteractive-tabindex`, `jsx-a11y/no-redundant-roles`, `jsx-a11y/no-static-element-interactions`, `jsx-a11y/prefer-tag-over-role`, `jsx-a11y/role-has-required-aria-props`, `jsx-a11y/role-supports-aria-props`, `jsx-a11y/scope`, `jsx-a11y/tabindex-no-positive`.

### Next.js

Next.js framework rules applied to TypeScript and TSX sources inside Next.js apps. Cover static TS/TSX Next.js source patterns the framework's runtime treats as load-bearing — pages/app routing, `<Head>` placement, font and script loading, image and link components, and common data export typos. Rules that need non-TypeScript files or runtime filesystem route discovery are intentionally conservative.

Source: [`@next/eslint-plugin-next`](https://github.com/vercel/next.js/tree/canary/packages/eslint-plugin-next) (MIT).

- `nextjs/google-font-display` — require `font-display` query on Google Font `<link>` URLs so initial render is not blocked.
- `nextjs/google-font-preconnect` — require `rel="preconnect"` for `fonts.gstatic.com` links to shave latency off Google Font fetches.
- `nextjs/inline-script-id` — require an `id` attribute on inline `<Script>` components from `next/script`.
- `nextjs/next-script-for-ga` — prefer the Next.js Google Analytics integration over hand-written `gtag` script tags.
- `nextjs/no-assign-module-variable` — reject local declarations named `module`, which shadow the CommonJS `module` binding Next.js relies on.
- `nextjs/no-async-client-component` — reject `async` function bodies on React Client Components.
- `nextjs/no-before-interactive-script-outside-document` — restrict the `next/script` `strategy="beforeInteractive"` option to `pages/_document.tsx`.
- `nextjs/no-css-tags` — reject raw `<link rel="stylesheet">` tags.
- `nextjs/no-document-import-in-page` — restrict `next/document` imports to `pages/_document.tsx`.
- `nextjs/no-duplicate-head` — reject more than one `<Head>` element from `next/document` in `pages/_document.tsx`.
- `nextjs/no-head-element` — reject raw `<head>` elements outside the `app/` directory.
- `nextjs/no-head-import-in-document` — reject `next/head` imports inside `pages/_document.tsx`.
- `nextjs/no-html-link-for-pages` — prefer `next/link` for internal anchors with a static `href`.
- `nextjs/no-img-element` — prefer `next/image` over raw `<img>` elements so the framework can optimize the asset.
- `nextjs/no-page-custom-font` — reject Google font `<link>` tags inside regular pages files.
- `nextjs/no-script-component-in-head` — reject `next/script` inside `next/head`.
- `nextjs/no-styled-jsx-in-document` — reject styled-jsx tags inside `pages/_document.tsx`.
- `nextjs/no-sync-scripts` — require `async` or `defer` on external raw `<script>` tags.
- `nextjs/no-title-in-document-head` — reject `<title>` inside `Head` from `next/document`.
- `nextjs/no-typos` — catch near-miss typos in Next.js data-fetching export names (`getStaticProps`, `getStaticPaths`, `getServerSideProps`).
- `nextjs/no-unwanted-polyfillio` — reject Polyfill.io script URLs.

### Solid

Solid TSX rules. Solid components compile to fine-grained reactivity, so patterns that look correct in React (destructuring props, calling `useEffect`-style hooks with array deps) silently break reactivity in Solid. AST-only, high-confidence Solid patterns after a Solid import is present.

Source: [`eslint-plugin-solid`](https://github.com/solidjs-community/eslint-plugin-solid) (MIT).

- `solid/reactivity`, `solid/no-destructure`, `solid/components-return-once` — catch common Solid reactivity breakages in components.
- `solid/jsx-no-undef`, `solid/jsx-no-duplicate-props`, `solid/jsx-no-script-url`, `solid/no-innerhtml`, `solid/no-unknown-namespaces` — guard JSX correctness and unsafe DOM attributes.
- `solid/event-handlers`, `solid/no-array-handlers`, `solid/no-react-specific-props` — keep DOM event and prop shapes aligned with Solid rather than React.
- `solid/imports`, `solid/no-react-deps`, `solid/no-proxy-apis` — enforce canonical Solid imports and non-React/non-Proxy call patterns.
- `solid/prefer-for`, `solid/prefer-show`, `solid/prefer-classlist`, `solid/self-closing-comp`, `solid/style-prop` — cover Solid rendering and style preferences.
- `solid/jsx-uses-vars` — accepted for config compatibility; does not emit native diagnostics because `@ttsc/lint` does not implement ESLint's unused-variable marker pass.

### Jest

Jest test source rules. Apply to TypeScript test files that use the Jest runner (`describe`, `test`/`it`, `expect`, lifecycle hooks). Guard test-quality patterns the type system cannot detect — unended assertions, focused tests left behind, duplicate hook calls.

Source: [`eslint-plugin-jest`](https://github.com/jest-community/eslint-plugin-jest) (MIT).

- `jest/expect-expect` — require every Jest test body to contain at least one `expect(...)` call.
- `jest/max-expects` — limit the number of `expect(...)` calls inside a single Jest test body.
- `jest/no-conditional-expect` — reject `expect(...)` calls under conditional branches in Jest tests.
- `jest/no-conditional-in-test` — reject conditional logic (`if`/`switch`/ternary) inside Jest test bodies.
- `jest/no-disabled-tests` — reject `test.skip` / `it.skip` / `describe.skip` / `.todo` variants.
- `jest/no-done-callback` — reject `done` callback parameters in Jest tests and lifecycle hooks.
- `jest/no-duplicate-hooks` — reject duplicate setup/teardown hook calls in the same `describe`.
- `jest/no-export` — reject `export` statements inside Jest test files.
- `jest/no-focused-tests` — reject `test.only` / `it.only` / `describe.only`.
- `jest/no-hooks` — reject Jest `beforeEach` / `afterEach` / `beforeAll` / `afterAll` hooks.
- `jest/no-identical-title` — reject duplicate Jest test or `describe` titles within the same suite scope.
- `jest/no-standalone-expect` — reject `expect(...)` calls outside Jest tests and hooks.
- `jest/no-test-prefixes` — reject the legacy `f`/`x` test prefixes (`fit`, `xit`, `fdescribe`, `xdescribe`).
- `jest/no-test-return-statement` — reject `return` statements that return non-Promise values from a Jest test callback.
- `jest/prefer-to-have-length` — prefer `expect(value).toHaveLength(n)` over asserting on `value.length` with `toBe`.
- `jest/require-to-throw-message` — require a message argument on `expect(...).toThrow(...)`.
- `jest/valid-describe-callback` — validate the shape of Jest `describe` callbacks.
- `jest/valid-expect` — validate `expect(...)` arity and matcher chaining: exactly one argument, terminated by a matcher call, and async matchers properly awaited.
- `jest/valid-title` — require non-empty static Jest test and `describe` titles.

### Vitest

Vitest test source rules. Vitest reuses much of Jest's testing surface but ships its own runner and configuration. These rules mirror the ergonomic subset of `eslint-plugin-jest` adapted for Vitest semantics — focused or disabled tests, duplicate titles, missing or conditional assertions, standalone `expect` calls, done callbacks, invalid `expect` chains, invalid titles, returned test values, and `.length` assertions that should use `toHaveLength`.

Source: [`@vitest/eslint-plugin`](https://github.com/vitest-dev/eslint-plugin-vitest) (MIT).

- `vitest/expect-expect` — require every Vitest test body to contain at least one `expect(...)` call.
- `vitest/no-conditional-expect` — reject `expect(...)` calls under conditional branches in Vitest tests.
- `vitest/no-conditional-tests` — reject `test(...)` / `it(...)` declarations inside loops or `if` branches.
- `vitest/no-disabled-tests` — reject `test.skip`, `it.skip`, `describe.skip`, and `.todo` variants.
- `vitest/no-done-callback` — reject `done` callback parameters in Vitest tests and lifecycle hooks.
- `vitest/no-focused-tests` — reject `test.only`, `it.only`, and `describe.only`.
- `vitest/no-identical-title` — reject duplicate Vitest test or `describe` titles within the same suite scope.
- `vitest/no-standalone-expect` — reject `expect(...)` calls outside Vitest tests and hooks.
- `vitest/no-test-return-statement` — reject `return` statements that return non-Promise values from a Vitest test callback.
- `vitest/prefer-to-have-length` — prefer `expect(value).toHaveLength(n)` over asserting on `value.length` with `toBe`.
- `vitest/valid-describe-callback` — validate the shape of Vitest `describe` callbacks.
- `vitest/valid-expect` — validate `expect(...)` arity and matcher chaining.
- `vitest/valid-title` — require non-empty static Vitest test and `describe` titles.

### Testing Library

Testing Library test source rules for TS/TSX test files. AST-only; rules report only after a Testing Library import is present in the file.

Source: [`eslint-plugin-testing-library`](https://github.com/testing-library/eslint-plugin-testing-library) (MIT).

- [`testing-library/await-async-events`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/async_query_event_and_util_promises_test.go), [`testing-library/await-async-queries`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/async_query_event_and_util_promises_test.go), [`testing-library/await-async-utils`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/async_query_event_and_util_promises_test.go) — require handling Promise-returning user-event methods, `findBy*` queries, and async utilities.
- [`testing-library/no-await-sync-events`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/async_query_event_and_util_promises_test.go), [`testing-library/no-await-sync-queries`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/async_query_event_and_util_promises_test.go) — reject unnecessary `await` on synchronous `fireEvent`, `getBy*`, and `queryBy*` calls.
- [`testing-library/no-container`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/render_result_dom_access_and_events_test.go), [`testing-library/no-node-access`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/render_result_dom_access_and_events_test.go), [`testing-library/prefer-screen-queries`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/prefer_screen_queries_test.go) — prefer `screen.*` queries over container access, DOM traversal, and render-result query functions.
- [`testing-library/no-debugging-utils`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/render_result_dom_access_and_events_test.go), [`testing-library/no-dom-import`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/misc_testing_library_rules_test.go), [`testing-library/no-manual-cleanup`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/misc_testing_library_rules_test.go), [`testing-library/no-test-id-queries`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/misc_testing_library_rules_test.go) — catch committed debug helpers, direct DOM package imports, manual cleanup, and test-id queries.
- [`testing-library/no-wait-for-multiple-assertions`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/wait_for_assertion_and_side_effect_guards_test.go), [`testing-library/no-wait-for-side-effects`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/wait_for_assertion_and_side_effect_guards_test.go), [`testing-library/no-wait-for-snapshot`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/wait_for_assertion_and_side_effect_guards_test.go), [`testing-library/prefer-find-by`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/wait_for_assertion_and_side_effect_guards_test.go), [`testing-library/prefer-query-by-disappearance`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/prefer_query_by_disappearance_test.go) — keep `waitFor` callbacks focused and prefer purpose-built queries.
- [`testing-library/prefer-user-event`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/render_result_dom_access_and_events_test.go), [`testing-library/prefer-user-event-setup`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/prefer_user_event_setup_ignores_setup_call_test.go), [`testing-library/no-promise-in-fire-event`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/no_promise_in_fire_event_test.go), [`testing-library/no-render-in-lifecycle`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/no_render_in_lifecycle_test.go), [`testing-library/no-unnecessary-act`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/no_unnecessary_act_test.go) — catch common event, render, and `act()` anti-patterns.
- [`testing-library/consistent-data-testid`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/misc_testing_library_rules_test.go), [`testing-library/no-global-regexp-flag-in-query`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/misc_testing_library_rules_test.go), [`testing-library/prefer-explicit-assert`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/prefer_explicit_assert_test.go), [`testing-library/prefer-implicit-assert`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/prefer_implicit_assert_test.go), [`testing-library/prefer-presence-queries`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/prefer_presence_queries_test.go), [`testing-library/prefer-query-matchers`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/prefer_query_matchers_test.go), [`testing-library/render-result-naming-convention`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/testing-library/misc_testing_library_rules_test.go) — cover configured test-id naming, assertion style, presence matchers, and render result names.

### Playwright

Playwright end-to-end test rules applied to TypeScript test files driven by the `@playwright/test` runner. Guard Playwright-specific patterns — locator usage, web-first assertions, focused/slowed tests — that would otherwise compile and run silently.

Source: [`eslint-plugin-playwright`](https://github.com/playwright-community/eslint-plugin-playwright) (MIT).

- [`playwright/expect-expect`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_expect_expect_test.go) — require every Playwright test body to contain at least one `expect(...)` call.
- [`playwright/max-expects`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_max_expects_test.go) — limit the assertion count inside a single Playwright test body.
- [`playwright/no-conditional-expect`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_no_conditional_expect_test.go) — reject `expect(...)` calls under conditional branches in Playwright tests.
- [`playwright/no-conditional-in-test`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_no_conditional_in_test_test.go) — reject conditional logic inside Playwright test bodies.
- [`playwright/no-duplicate-hooks`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_no_duplicate_hooks_test.go) — reject duplicate Playwright setup/teardown hook calls in the same `test.describe`.
- [`playwright/no-duplicate-slow`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_no_duplicate_slow_test.go) — reject repeated `test.slow()` calls inside the same test.
- [`playwright/no-element-handle`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_no_element_handle_test.go) — reject the legacy `ElementHandle`-style Playwright API (`page.$`, `page.$$`).
- [`playwright/no-eval`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_no_eval_test.go) — reject `page.$eval` and `page.$$eval`.
- [`playwright/no-focused-test`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_no_focused_test_test.go) — reject `test.only`, `test.describe.only`, and similar focused Playwright tests.
- [`playwright/no-force-option`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_no_force_option_test.go) — reject Playwright `{ force: true }` options on actionable commands.
- [`playwright/no-get-by-title`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_no_get_by_title_test.go) — reject `getByTitle(...)` locators.
- [`playwright/no-hooks`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_no_hooks_test.go) — reject Playwright `test.beforeEach` / `test.afterEach` / etc.
- [`playwright/no-nested-step`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_no_nested_step_test.go) — reject nested `test.step(...)` calls.
- [`playwright/no-networkidle`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_no_networkidle_test.go) — reject the `networkidle` load-state in `page.waitForLoadState` and navigation options.
- [`playwright/no-nth-methods`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_no_nth_methods_test.go) — reject `.first()`, `.last()`, and `.nth(...)` on locators.
- [`playwright/no-page-pause`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_no_page_pause_test.go) — reject `page.pause()` debugging calls.
- [`playwright/no-skipped-test`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_no_skipped_test_test.go) — reject `test.skip`, `test.describe.skip`, and the conditional `test.skip()` annotation.
- [`playwright/no-slowed-test`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_no_slowed_test_test.go) — reject `test.slow()` marks on Playwright tests.
- [`playwright/no-standalone-expect`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_no_standalone_expect_test.go) — reject `expect(...)` calls outside the body of a Playwright test or lifecycle hook.
- [`playwright/no-wait-for-navigation`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_no_wait_for_navigation_test.go) — reject `page.waitForNavigation`.
- [`playwright/no-wait-for-selector`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_no_wait_for_selector_test.go) — reject `page.waitForSelector`.
- [`playwright/no-wait-for-timeout`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_no_wait_for_timeout_test.go) — reject `page.waitForTimeout(ms)` sleeps.
- [`playwright/prefer-locator`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_prefer_locator_test.go) — prefer locator-based Playwright APIs over page-level convenience methods.
- [`playwright/prefer-to-have-count`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_prefer_to_have_count_test.go) — prefer `expect(locator).toHaveCount(n)` over asserting on `await locator.count()`.
- [`playwright/prefer-to-have-length`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_prefer_to_have_length_test.go) — prefer `expect(value).toHaveLength(n)` over asserting on `value.length` directly.
- [`playwright/prefer-web-first-assertions`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_prefer_web_first_assertions_test.go) — prefer Playwright web-first assertions over composed manual waits.
- [`playwright/require-to-pass-timeout`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_require_to_pass_timeout_test.go) — require an explicit `timeout` option on `expect(...).toPass(...)`.
- [`playwright/require-to-throw-message`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_require_to_throw_message_test.go) — require a message argument on `expect(...).toThrow(...)`.
- [`playwright/valid-describe-callback`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_valid_describe_callback_test.go) — validate the shape of Playwright `test.describe` callbacks.
- [`playwright/valid-expect`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_valid_expect_test.go) — validate `expect(...)` arity and matcher chaining.
- [`playwright/valid-title`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/playwright/playwright_valid_title_test.go) — require non-empty static Playwright test and `describe` titles.

### Cypress

Cypress end-to-end test rules. Apply to TypeScript/TSX sources that use the Cypress runner (`cy.*` commands and Mocha-style `describe`/`it` blocks). Detect Cypress-specific anti-patterns such as async test bodies, missing assertions before screenshots, or deprecated XPath selectors.

Source: [`eslint-plugin-cypress`](https://github.com/cypress-io/eslint-plugin-cypress) (MIT).

- [`cypress/assertion-before-screenshot`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/cypress/cypress_assertion_before_screenshot_reports_unchecked_screenshot_test.go) — require a Cypress assertion before `cy.screenshot()`.
- [`cypress/no-and`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/cypress/cypress_no_and_reports_chain_starting_and_test.go) — prefer `.should()` over `.and()` when starting Cypress assertion chains.
- [`cypress/no-assigning-return-values`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/cypress/cypress_no_assigning_return_values_reports_cy_assignment_test.go) — reject assigning the return value of Cypress commands.
- [`cypress/no-async-before`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/cypress/cypress_no_async_before_reports_async_before_each_test.go) — reject async `before` and `beforeEach` callbacks.
- [`cypress/no-async-tests`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/cypress/cypress_no_async_tests_reports_async_it_test.go) — reject async Cypress test callbacks.
- [`cypress/no-chained-get`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/cypress/cypress_no_chained_get_reports_second_get_test.go) — reject chained `.get()` calls.
- [`cypress/no-debug`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/cypress/cypress_no_debug_reports_debug_command_test.go) — reject `cy.debug()` and chained `.debug()` commands.
- [`cypress/no-force`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/cypress/cypress_no_force_reports_force_true_option_test.go) — reject `{ force: true }` on Cypress action commands.
- [`cypress/no-pause`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/cypress/cypress_no_pause_reports_pause_command_test.go) — reject `cy.pause()` and chained `.pause()` commands.
- [`cypress/no-unnecessary-waiting`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/cypress/cypress_no_unnecessary_waiting_reports_numeric_wait_test.go) — reject numeric `cy.wait(...)` sleeps.
- [`cypress/no-xpath`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/cypress/cypress_no_xpath_reports_xpath_command_test.go) — reject deprecated `cy.xpath()` selectors.
- [`cypress/require-data-selectors`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/cypress/cypress_require_data_selectors_reports_class_selector_test.go) — require statically known `cy.get()` selectors to target `data-*` attributes.
- [`cypress/unsafe-to-chain-command`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/cypress/cypress_unsafe_to_chain_command_reports_action_middle_test.go) — reject chaining more commands after Cypress action commands.

### Storybook

Storybook CSF and configuration rules. Apply to `*.stories.ts(x)` and `.storybook/main.ts` files. Cover CSF metadata shape, named story exports, deprecated `storiesOf`, interaction-test imports, direct renderer-package imports, and addon installation checks. `storybook/no-uninstalled-addons` accepts `{ packageJsonLocation?: string; ignore?: string[] }`; without an explicit path it walks upward from the linted Storybook config file to find `package.json`.

Source: [`eslint-plugin-storybook`](https://github.com/storybookjs/eslint-plugin-storybook) (MIT).

- [`storybook/await-interactions`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/storybook/await_interactions_test.go) — require play-function interactions to be awaited.
- [`storybook/context-in-play-function`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/storybook/context_in_play_function_test.go) — require forwarding the play-function `context` argument when invoking another story's `play` function.
- [`storybook/csf-component`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/storybook/csf_component_test.go) — require the CSF default meta object to declare a `component`.
- [`storybook/default-exports`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/storybook/default_exports_test.go) — require every story file to provide the CSF default export.
- [`storybook/hierarchy-separator`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/storybook/hierarchy_separator_test.go) — reject the legacy `|` separator in Storybook story titles.
- [`storybook/meta-inline-properties`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/storybook/meta_inline_properties_test.go) — require `title` and `args` in CSF meta to be inline literals.
- [`storybook/meta-satisfies-type`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/storybook/meta_satisfies_type_test.go) — require CSF meta objects to type-check with `satisfies Meta<…>` rather than a `: Meta<…>` annotation or `as` cast.
- [`storybook/no-redundant-story-name`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/storybook/no_redundant_story_name_test.go) — reject `name` metadata on a story when it matches Storybook's auto-derived name from the export identifier.
- [`storybook/no-renderer-packages`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/storybook/no_renderer_packages_test.go) — reject direct imports from Storybook renderer packages.
- [`storybook/no-stories-of`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/storybook/no_stories_of_test.go) — reject the legacy `storiesOf(...)` builder API.
- [`storybook/no-title-property-in-meta`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/storybook/no_title_property_in_meta_test.go) — reject the `title` property in CSF meta when the project uses Storybook's auto-title generation.
- [`storybook/no-uninstalled-addons`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/storybook/no_uninstalled_addons_test.go) — validate Storybook addon names against the project's dependencies.
- [`storybook/prefer-pascal-case`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/storybook/prefer_pascal_case_test.go) — require named story exports to use PascalCase.
- [`storybook/story-exports`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/storybook/story_exports_test.go) — require every story file to export at least one named story alongside the default meta.
- [`storybook/use-storybook-expect`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/storybook/use_storybook_expect_test.go) — require `expect` to be imported from `@storybook/test` in play functions.
- [`storybook/use-storybook-testing-library`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/storybook/use_storybook_testing_library_test.go) — reject direct Testing Library imports inside story files; use the Storybook-bundled re-exports.

### TanStack Query

TanStack Query rules. Guard the ergonomic and correctness contracts of TanStack Query (`useQuery`, `useMutation`, query-options factories) inside React TypeScript sources.

Source: [`@tanstack/eslint-plugin-query`](https://github.com/TanStack/query/tree/main/packages/eslint-plugin-query) (MIT).

- [`tanstack-query/exhaustive-deps`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/tanstack-query/tanstack_query_exhaustive_deps_test.go) — require `queryKey` arrays to enumerate every reactive identifier the `queryFn` reads.
- [`tanstack-query/infinite-query-property-order`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/tanstack-query/tanstack_query_infinite_query_property_order_test.go) — require `queryFn`, `getPreviousPageParam`, and `getNextPageParam` inside `useInfiniteQuery` to appear in the order TanStack Query documents.
- [`tanstack-query/mutation-property-order`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/tanstack-query/tanstack_query_mutation_property_order_test.go) — require `useMutation` callbacks to declare `onMutate` before `onError` and `onSettled`.
- [`tanstack-query/no-rest-destructuring`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/tanstack-query/tanstack_query_no_rest_destructuring_test.go) — reject `...rest` destructuring on TanStack Query hook results.
- [`tanstack-query/no-unstable-deps`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/tanstack-query/tanstack_query_no_unstable_deps_test.go) — reject passing entire TanStack Query hook results into React dependency arrays.
- [`tanstack-query/no-void-query-fn`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/tanstack-query/tanstack_query_no_void_query_fn_test.go) — reject `queryFn` callbacks that resolve to `void`.
- [`tanstack-query/prefer-query-options`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/tanstack-query/tanstack_query_prefer_query_options_test.go) — prefer wrapping query options in the `queryOptions()` helper.
- [`tanstack-query/stable-query-client`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/tanstack-query/tanstack_query_stable_query_client_test.go) — reject creating a `QueryClient` inside a React component or hook body.

### Promise

Promise correctness and style rules. Check the chain shape of Promise-using code: every chain ends with `catch`, no callback inside a `then`, no nested `.then().then()`, and so on. AST-local only — type-aware Promise checks belong with `typescript/*` checker rules.

Source: [`eslint-plugin-promise`](https://github.com/eslint-community/eslint-plugin-promise) (ISC).

- [`promise/always-return`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/promise/promise_always_return_test.go) — require `.then(...)` callbacks to return a value or throw.
- [`promise/avoid-new`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/promise/promise_avoid_new_test.go) — reject every `new Promise(...)` construction.
- [`promise/catch-or-return`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/promise/promise_catch_or_return_test.go) — require unreturned promise chains to terminate with `catch()`.
- [`promise/no-callback-in-promise`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/promise/promise_no_callback_in_promise_test.go) — reject direct invocation of an error-first callback inside a `then()` or `catch()` handler.
- [`promise/no-multiple-resolved`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/promise/promise_no_multiple_resolved_test.go) — detect Promise executor bodies with more than one resolve/reject call.
- [`promise/no-native`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/promise/promise_no_native_test.go) — require every file that uses `Promise` to import or require the implementation explicitly.
- [`promise/no-nesting`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/promise/promise_no_nesting_test.go) — reject nested `then()`/`catch()` calls inside the body of a Promise callback.
- [`promise/no-new-statics`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/promise/promise_no_new_statics_test.go) — reject `new` applied to Promise statics such as `new Promise.resolve(x)`.
- [`promise/no-promise-in-callback`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/promise/promise_no_promise_in_callback_test.go) — reject building a promise chain inside the body of an error-first callback.
- [`promise/no-return-in-finally`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/promise/promise_no_return_in_finally_test.go) — reject `return` from inside a `finally()` callback.
- [`promise/no-return-wrap`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/promise/promise_no_return_wrap_test.go) — reject `return Promise.resolve(x)` and `return Promise.reject(x)` inside promise callbacks.
- [`promise/param-names`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/promise/promise_param_names_test.go) — enforce canonical parameter names (`resolve`, `reject`) on Promise executor functions.
- [`promise/prefer-await-to-callbacks`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/promise/promise_prefer_await_to_callbacks_test.go) — flag continuation-passing callback shapes and suggest an `async`/`await` rewrite.
- [`promise/prefer-await-to-then`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/promise/promise_prefer_await_to_then_test.go) — prefer `await` over explicit `.then()`/`.catch()`/`.finally()` chains inside `async` functions.
- [`promise/prefer-catch`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/promise/promise_prefer_catch_test.go) — prefer `.catch(handler)` over the two-argument form `.then(onFulfilled, onRejected)`.
- [`promise/spec-only`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/promise/promise_spec_only_test.go) — reject non-standard `Promise` statics such as `Promise.done`, `Promise.spread`, or library-specific extensions shimmed onto the global.
- [`promise/valid-params`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/promise/promise_valid_params_test.go) — enforce the argument counts the Promise spec defines for each method.

### Regular expressions

Regex-shape rules. Check the structure of regex literals — emptiness, uselessness, flag ordering, shorthand classes, Unicode support. Some rules supersede the regex-related rules in [ESLint core](#eslint-core); both ids exist so projects can keep the legacy ESLint names alongside the regexp-plugin variants.

Source: [`eslint-plugin-regexp`](https://github.com/ota-meshi/eslint-plugin-regexp) (MIT).

- [`regexp/no-control-character`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/strings-regex/regexp_alias_rules_test.go) — reject control characters (`\x00`–`\x1F`) embedded in regex literals.
- [`regexp/no-dupe-characters-character-class`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/strings-regex/regexp_character_class_and_group_rules_test.go) — reject duplicate literal characters inside simple regex character classes (`/[aa]/`).
- [`regexp/no-empty-alternative`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/strings-regex/regexp_character_class_and_group_rules_test.go) — reject empty alternatives in a disjunction (`/a||b/`).
- [`regexp/no-empty-capturing-group`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/strings-regex/regexp_character_class_and_group_rules_test.go) — reject empty capturing groups such as `/()/`.
- [`regexp/no-empty-character-class`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/strings-regex/regexp_alias_rules_test.go) — reject empty regex character classes (`[]`).
- [`regexp/no-empty-group`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/strings-regex/regexp_character_class_and_group_rules_test.go) — reject empty non-capturing groups such as `/(?:)/`.
- [`regexp/no-empty-lookarounds-assertion`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/strings-regex/regexp_character_class_and_group_rules_test.go) — reject empty lookaround assertions such as `/(?=)/` or `/(?!)/`.
- [`regexp/no-misleading-unicode-character`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/strings-regex/regexp_alias_rules_test.go) — reject misleading Unicode characters in regex classes.
- [`regexp/no-useless-character-class`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/strings-regex/regexp_character_class_and_group_rules_test.go) — reject single-character character classes such as `/[x]/`.
- [`regexp/no-useless-escape`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/strings-regex/regexp_alias_rules_test.go) — reject unnecessary escapes inside regex literals.
- [`regexp/no-useless-flag`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/strings-regex/regexp_quantifier_and_flag_rules_test.go) — reject regex flags that the literal does not exercise.
- [`regexp/no-useless-quantifier`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/strings-regex/regexp_quantifier_and_flag_rules_test.go) — reject quantifiers that do not change the match.
- [`regexp/no-useless-two-nums-quantifier`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/strings-regex/regexp_quantifier_and_flag_rules_test.go) — reject equal min/max quantifiers (`/a{2,2}/`) in favor of `/a{2}/`.
- [`regexp/no-zero-quantifier`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/strings-regex/regexp_quantifier_and_flag_rules_test.go) — reject zero-repeat quantifiers (`/a{0}/`, `/a{0,0}/`).
- [`regexp/prefer-d`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/strings-regex/regexp_character_class_and_group_rules_test.go) — prefer `\d` over `[0-9]` in regex literals.
- [`regexp/prefer-plus-quantifier`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/strings-regex/regexp_quantifier_and_flag_rules_test.go) — prefer `+` over `{1,}` in regex literals.
- [`regexp/prefer-question-quantifier`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/strings-regex/regexp_quantifier_and_flag_rules_test.go) — prefer `?` over `{0,1}` in regex literals.
- [`regexp/prefer-star-quantifier`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/strings-regex/regexp_quantifier_and_flag_rules_test.go) — prefer `*` over `{0,}` in regex literals.
- [`regexp/prefer-w`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/strings-regex/regexp_character_class_and_group_rules_test.go) — prefer `\w` over `[A-Za-z0-9_]` in regex literals.
- [`regexp/require-unicode-regexp`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/strings-regex/regexp_quantifier_and_flag_rules_test.go) — require regex literals to use the `u` or `v` flag.
- [`regexp/require-unicode-sets-regexp`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/strings-regex/regexp_quantifier_and_flag_rules_test.go) — require regex literals to use the `v` flag specifically.
- [`regexp/sort-flags`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/strings-regex/regexp_quantifier_and_flag_rules_test.go) — require regex flags to appear in canonical alphabetical order (`dgimsuvy`).

### Security

Security-focused TypeScript source rules. Report likely security smells — non-literal sinks for eval, file I/O, regex construction, child-process spawning, cryptographic primitives — that warrant human review even if no exploit is statically provable. Treat findings as *hints*, not proofs.

Source: [`eslint-plugin-security@4.0.0`](https://github.com/eslint-community/eslint-plugin-security) (Apache-2.0 — distribution requires propagating the upstream NOTICE attribution).

- [`security/detect-bidi-characters`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/security/security_detect_bidi_characters_test.go) — detect Trojan Source bidi control characters.
- [`security/detect-buffer-noassert`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/security/security_detect_buffer_noassert_test.go) — detect Buffer reads/writes with `noAssert` set to true.
- [`security/detect-child-process`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/security/security_detect_child_process_test.go) — detect child_process imports and non-literal `exec` commands.
- [`security/detect-disable-mustache-escape`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/security/security_detect_disable_mustache_escape_test.go) — detect `escapeMarkup = false` on objects.
- [`security/detect-eval-with-expression`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/security/security_detect_eval_with_expression_test.go) — detect `eval` fed by non-literal expressions.
- [`security/detect-new-buffer`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/security/security_detect_new_buffer_test.go) — detect `new Buffer` with non-literal input.
- [`security/detect-no-csrf-before-method-override`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/security/security_detect_no_csrf_before_method_override_test.go) — detect Express csrf middleware before methodOverride.
- [`security/detect-non-literal-fs-filename`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/security/security_detect_non_literal_fs_filename_test.go) — detect filesystem calls with non-literal filename arguments.
- [`security/detect-non-literal-regexp`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/security/security_detect_non_literal_regexp_test.go) — detect RegExp construction from non-literal patterns.
- [`security/detect-non-literal-require`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/security/security_detect_non_literal_require_test.go) — detect `require` calls with non-literal module specifiers.
- [`security/detect-object-injection`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/security/security_detect_object_injection_test.go) — detect dynamic bracket access sinks.
- [`security/detect-possible-timing-attacks`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/security/security_detect_possible_timing_attacks_test.go) — detect direct equality comparisons involving secret-like identifiers.
- [`security/detect-pseudoRandomBytes`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/security/security_detect_pseudo_random_bytes_test.go) — detect `crypto.pseudoRandomBytes`.
- [`security/detect-unsafe-regex`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/security/security_detect_unsafe_regex_test.go) — detect high-confidence catastrophic backtracking regex shapes.

### JSDoc

Documentation-comment validation rules. Bundles `eslint-plugin-jsdoc` content checks (tag names, parameter coverage, descriptions) with the lone `eslint-plugin-tsdoc` syntax check (`jsdoc/tsdoc-syntax`) — both target `/** ... */` comments. Formatting concerns (alignment, indentation) are configured through the top-level [`format`](#format) block, not here.

Source: [`eslint-plugin-jsdoc`](https://github.com/gajus/eslint-plugin-jsdoc) (BSD-3-Clause — attribution required), [`eslint-plugin-tsdoc`](https://github.com/microsoft/tsdoc) (MIT).

- [`jsdoc/check-tag-names`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/jsdoc/check_tag_names_test.go) — reject unknown JSDoc block tag names.
- [`jsdoc/check-values`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/jsdoc/check_values_test.go) — validate closed-set JSDoc tag values such as `@access`.
- [`jsdoc/empty-tags`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/jsdoc/empty_tags_test.go) — reject content on marker-only JSDoc tags such as `@async`.
- [`jsdoc/no-types`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/jsdoc/no_types_test.go) — reject redundant JSDoc type braces in TypeScript source comments.
- [`jsdoc/reject-any-type`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/jsdoc/reject_any_type_test.go) — reject `any` and `*` inside JSDoc type braces.
- [`jsdoc/reject-function-type`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/jsdoc/reject_function_type_test.go) — reject the unsafe `Function` type inside JSDoc type braces.
- [`jsdoc/require-description`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/jsdoc/require_description_test.go) — require JSDoc blocks to include block-level description text.
- [`jsdoc/require-param-description`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/jsdoc/require_param_description_test.go) — require every `@param` tag with a name to include a description.
- [`jsdoc/require-param-name`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/jsdoc/require_param_name_test.go) — require every `@param` tag to include a parameter name.
- [`jsdoc/require-property-description`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/jsdoc/require_property_description_test.go) — require every `@property` tag with a name to include a description.
- [`jsdoc/require-property-name`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/jsdoc/require_property_name_test.go) — require every `@property` tag to include a property name.
- [`jsdoc/require-returns-description`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/jsdoc/require_returns_description_test.go) — require every `@returns` tag to include a description.
- [`jsdoc/tsdoc-syntax`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/comments-directives/tsdoc_syntax_test.go) — validate malformed TSDoc block tags and inline tags in `/** ... */` comments.

### Functional

Functional-programming policy rules. Push code toward immutability, side-effect-free expressions, and expression-style control flow. Most rules are useful in pieces — projects rarely enable the whole family at `"error"`. Enabling the whole set together expresses a strict functional-core / imperative-shell discipline. Diagnostic-only: `ttsc fix` does not rewrite mutation, classes, exceptions, loops, or branching into a functional design.

Source: [`eslint-plugin-functional`](https://github.com/eslint-functional/eslint-plugin-functional) (MIT).

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

- [`functional/functional-parameters`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_parameters_rejects_rest_parameter_test.go) — rejects rest parameters, `arguments`, and optionally zero-parameter functions.
- [`functional/immutable-data`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_immutable_data_rejects_property_assignment_test.go) — rejects writes through object/array members and mutable collection methods.
- [`functional/no-class-inheritance`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_no_class_inheritance_rejects_extends_test.go) — rejects class inheritance and abstract classes.
- [`functional/no-classes`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_no_classes_rejects_class_declaration_test.go) — rejects class declarations and expressions.
- [`functional/no-conditional-statements`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_no_conditional_statements_rejects_if_test.go) — rejects `if` and `switch` statements.
- [`functional/no-expression-statements`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_no_expression_statements_rejects_call_test.go) — rejects expression statements used for side effects.
- [`functional/no-let`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_no_let_rejects_let_declaration_test.go) — rejects `let` declarations.
- [`functional/no-loop-statements`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_no_loop_statements_rejects_for_test.go) — rejects imperative loop statements.
- [`functional/no-mixed-types`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_no_mixed_types_rejects_method_and_property_test.go) — rejects type/interface declarations that mix member shapes.
- [`functional/no-promise-reject`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_no_promise_reject_rejects_static_call_test.go) — rejects `Promise.reject(...)`.
- [`functional/no-return-void`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_no_return_void_rejects_void_return_test.go) — rejects void returns and void-returning declarations.
- [`functional/no-this-expressions`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_no_this_expressions_rejects_this_test.go) — rejects `this` expressions.
- [`functional/no-throw-statements`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_no_throw_statements_rejects_throw_test.go) — rejects `throw` statements.
- [`functional/no-try-statements`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_no_try_statements_rejects_catch_test.go) — rejects `try`/`catch`/`finally` statements.
- [`functional/prefer-immutable-types`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_prefer_immutable_types_rejects_mutable_parameter_array_test.go) — prefers readonly/immutable type annotations.
- [`functional/prefer-property-signatures`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_prefer_property_signatures_rejects_method_signature_test.go) — prefers function-property signatures over method signatures.
- [`functional/prefer-readonly-type`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_prefer_readonly_type_rejects_array_type_test.go) — requires readonly array, tuple, and property type syntax.
- [`functional/prefer-tacit`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_prefer_tacit_rejects_trivial_wrapper_test.go) — reports simple one-argument forwarding wrappers.
- [`functional/readonly-type`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_readonly_type_rejects_readonly_array_generic_test.go) — enforces the configured readonly type spelling.
- [`functional/type-declaration-immutability`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_type_declaration_immutability_rejects_mutable_interface_test.go) — requires matching type declarations to expose readonly member shapes.

### Architecture boundaries

Architecture-boundary rules enforce import direction and module visibility between configured source-path *elements* (layers, features, apps in a monorepo). Every rule operates on the *resolved source file* of an import — relative imports are followed to the real `.ts`/`.tsx`/`.d.ts` file before classification. Boundary diagnostics do not offer autofixes — a violation usually needs an API or architecture decision, not a mechanical import rewrite.

Source: ported from [`eslint-plugin-boundaries`](https://github.com/javierbrea/eslint-plugin-boundaries) (MIT).

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

- [`boundaries/element-types`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/boundaries/boundaries_element_types_rejects_disallowed_import_test.go) — enforces allowed dependency directions between configured source-path element types.
- [`boundaries/entry-point`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/boundaries/boundaries_entry_point_rejects_non_entry_import_test.go) — requires imports into an element to target its configured public entry files.
- [`boundaries/external`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/boundaries/boundaries_external_rejects_disallowed_package_test.go) — restricts external package imports by package/specifier pattern.
- [`boundaries/no-private`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/boundaries/boundaries_no_private_rejects_cross_element_private_import_test.go) — rejects imports of configured private files from outside their element.
- [`boundaries/no-unknown`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/boundaries/boundaries_no_unknown_rejects_unknown_import_target_test.go) — rejects relative imports whose resolved source file matches no configured element.

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
