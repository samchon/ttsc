# `@ttsc/lint`

![banner of @ttsc/lint](https://ttsc.dev/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE)
[![NPM Version](https://img.shields.io/npm/v/@ttsc/lint.svg)](https://www.npmjs.com/package/@ttsc/lint)
[![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/lint.svg)](https://www.npmjs.com/package/@ttsc/lint)
[![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest)
[![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs)
[![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

A linter and formatter. Co-protagonist of the [`ttsc`](https://ttsc.dev) toolchain — paired with `ttsc`, it replaces `eslint` and `prettier`.

140+ rules. Lint violations surface as `error TSxxxxx` from a single compile pass; the formatter applies via `ttsc format`.

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

src/index.ts:2:5 - error TS17397: [preferConst] Use const instead of let.

2 let y: number = 4;
      ~~~~~~~~~~~~~

src/index.ts:1:1 - error TS11966: [noVar] Unexpected var, use let or const instead.

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
    noVar: "error",
    preferConst: "error",
    noExplicitAny: "warning",
    noConsole: "off",
  },
} satisfies ITtscLintConfig;
```

Run your normal `ttsc` or `ttsx`:

```bash
npx ttsc
npx ttsx src/index.ts
```

Errors fail the command; warnings print without affecting the exit code. Under `ttsx`, errors stop the program before your entrypoint runs.

## Fix and format

`ttsc fix` applies every autofix the enabled rules offer — lint and format together — writes results back to disk, then re-runs type-check + lint. `ttsc format` runs the format rule set through the same dataflow.

```bash
npx ttsc fix
npx ttsc format
```

`ttsc fix` is a one-shot project pass and rejects `--watch`, single-file mode, and `--emit`. Fixes are written to disk before the recheck runs, so source stays modified even when the command exits non-zero on remaining errors. Recommended flow: run `ttsc fix` locally, commit, then have CI run `ttsc --noEmit` to gate on zero remaining errors.

## Configurations

Two top-level keys in `lint.config.ts`:

- `format` is a Prettier-style block that drives format autofixes. Format diagnostics are warnings and do not define compile failure policy.
- `rules` sets severity per lint rule. `"error"` fails the build; `"warning"` prints without affecting the exit code; `"off"` disables the rule.

### Format

The `format` block in `lint.config.ts` configures the formatter. Keys mirror `.prettierrc`:

```ts
// lint.config.ts
export default {
  format: {
    printWidth: 100,
    singleQuote: true,
    trailingComma: "all",
    importOrder: ["<THIRD_PARTY_MODULES>", "@api(.*)$", "^[./]"],
    jsdoc: true,
  },
  rules: { noVar: "error" },
} satisfies ITtscLintConfig;
```

Presence of the block (even empty `format: {}`) configures the always-on format rules at Prettier defaults for `ttsc format`. It does not make `ttsc check` fail on formatting by default; set `format.severity` only if you intentionally want check-time format diagnostics.

Each `format` key drives one rule:

| Rule | Driven by | Effect |
| --- | --- | --- |
| all format rules | `severity` (default `"off"`) | Optional check-time diagnostic severity. `ttsc format` still applies configured format rules when this is off. |
| `formatSemi` | `semi` | Insert trailing semicolons on ASI-terminated statements. |
| `formatQuotes` | `singleQuote` | Convert quoted strings to the preferred quote style. |
| `formatTrailingComma` | `trailingComma` | Add trailing commas to multi-line lists. |
| `formatPrintWidth` | `printWidth`, `tabWidth`, `useTabs`, `endOfLine` | Column-aware line reflow. Object/array literals, call/new arguments, and named import/export clauses break across lines when their flat form overflows the budget. |
| `formatSortImports` | `importOrder` (opt-in) | Group external/relative imports and alphabetize each group + its specifiers. |
| `formatJsdoc` | `jsdoc` (opt-in) | Normalize JSDoc blocks toward [prettier-plugin-jsdoc](https://github.com/hosseinmd/prettier-plugin-jsdoc). |

`formatSortImports` and `formatJsdoc` are **opt-in**: they only run when you set their `format` keys. Every other format rule is available to `ttsc format` as soon as a `format` block is present.

To disable or override one specific format rule, drop a sibling `rules` entry — `rules` wins on conflict:

```ts
export default {
  format: { severity: "warning", semi: true },
  rules: { formatSemi: "off" },
} satisfies ITtscLintConfig;
```
### Rules

Rules are off until you enable them:

```ts
// lint.config.ts
export default {
  rules: {
    noVar: "error",
    "eqeqeq": "error",
    preferTemplate: "warning",
    noNonNullAssertion: "off",
  },
} satisfies ITtscLintConfig;
```

The rule corpus is tested in `tests/test-lint/src/cases/*.ts`, which is the best place to check the exact patterns currently covered. Each rule below links to its tested fixture:

- [`adjacentOverloadSignatures`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/adjacent-overload-signatures.ts): keeps overload declarations for the same member adjacent.
- [`arrayType`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/array-type.ts): prefers `T[]` and `readonly T[]` over array helper types.
- [`awaitThenable`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/await-thenable.ts): rejects `await` on a value that is neither a Promise nor a thenable (type-aware).
- [`banTsComment`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/ban-ts-comment.ts): rejects TypeScript suppression comments such as `@ts-ignore`.
- [`banTslintComment`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/ban-tslint-comment.ts): rejects obsolete `tslint:` comments.
- [`consistentIndexedObjectStyle`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/consistent-indexed-object-style.ts): prefers `Record` for single index-signature object types.
- [`consistentTypeAssertions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/consistent-type-assertions.ts): prefers `as` type assertions over angle-bracket assertions.
- [`consistentTypeDefinitions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/consistent-type-definitions.ts): prefers interfaces for object-shaped type definitions.
- [`consistentTypeImports`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/consistent-type-imports/violation.ts): uses `import type` when imported names are type-only.
- [`defaultParamLast`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/default-param-last.ts): keeps parameters with default values at the end of the list.
- [`dotNotation`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/dot-notation.ts): prefers dot property access when a string-literal key is a valid identifier.
- [`eqeqeq`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/eqeqeq.ts): requires strict equality operators.
- [`forDirection`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/for-direction.ts): catches loop counters updated in the wrong direction.
- [`noAlert`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-alert.ts): rejects `alert`, `confirm`, and `prompt`.
- [`noArrayConstructor`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-array-constructor.ts): rejects `Array` constructor calls.
- [`noArrayDelete`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-array-delete.ts): rejects `delete` on array elements.
- [`noAsyncPromiseExecutor`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-async-promise-executor.ts): rejects async Promise executors.
- [`noBitwise`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-bitwise.ts): rejects bitwise operators.
- [`noCaller`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-caller.ts): rejects `arguments.caller` and `arguments.callee`.
- [`noCaseDeclarations`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-case-declarations.ts): rejects lexical declarations directly inside `case` clauses.
- [`noClassAssign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-class-assign.ts): rejects reassignment of class declarations.
- [`noCompareNegZero`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-compare-neg-zero.ts): rejects comparisons against `-0`.
- [`noCondAssign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-cond-assign.ts): rejects assignments inside conditions.
- [`noConfusingNonNullAssertion`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-confusing-non-null-assertion.ts): rejects confusing non-null assertions next to equality checks.
- [`noConsole`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-console.ts): rejects `console` calls.
- [`noConstantCondition`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-constant-condition.ts): rejects constant conditions.
- [`noContinue`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-continue.ts): rejects `continue` statements.
- [`noControlRegex`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-control-regex.ts): rejects control characters in regular expressions.
- [`noDebugger`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-debugger.ts): rejects `debugger` statements.
- [`noDeleteVar`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-delete-var.ts): rejects deleting variables.
- [`noDupeArgs`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-dupe-args.ts): rejects duplicate function parameters.
- [`noDupeElseIf`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-dupe-else-if.ts): rejects repeated `else if` conditions.
- [`noDupeKeys`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-dupe-keys.ts): rejects duplicate object keys.
- [`noDuplicateCase`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-duplicate-case.ts): rejects duplicate `switch` case labels.
- [`noDuplicateEnumValues`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-duplicate-enum-values.ts): rejects duplicate enum member values.
- [`noDynamicDelete`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-dynamic-delete.ts): rejects `delete` on dynamically computed property keys.
- [`noEmpty`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty.ts): rejects empty blocks.
- [`noEmptyCharacterClass`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-character-class.ts): rejects empty regex character classes.
- [`noEmptyFunction`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-function.ts): rejects empty functions.
- [`noEmptyInterface`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-interface.ts): rejects empty interfaces.
- [`noEmptyObjectType`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-object-type.ts): rejects empty object type literals.
- [`noEmptyPattern`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-pattern.ts): rejects empty destructuring patterns.
- [`noEmptyStaticBlock`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-static-block.ts): rejects empty class static blocks.
- [`noEqNull`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-eq-null.ts): rejects loose null comparisons.
- [`noEval`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-eval.ts): rejects `eval`.
- [`noExAssign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-ex-assign.ts): rejects reassignment of caught exceptions.
- [`noExplicitAny`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-explicit-any.ts): rejects explicit `any`.
- [`noExtraBind`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-extra-bind.ts): rejects unnecessary `.bind()` calls.
- [`noExtraBooleanCast`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-extra-boolean-cast.ts): rejects redundant boolean casts.
- [`noExtraNonNullAssertion`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-extra-non-null-assertion.ts): rejects repeated non-null assertions.
- [`noFallthrough`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-fallthrough.ts): rejects unmarked `switch` fallthrough.
- [`noFuncAssign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-func-assign.ts): rejects reassignment of function declarations.
- [`noImportTypeSideEffects`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-import-type-side-effects/violation.ts): hoists inline `type` modifiers into a single `import type` declaration.
- [`noInferrableTypes`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-inferrable-types.ts): rejects type annotations TypeScript can infer.
- [`noInnerDeclarations`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-inner-declarations.ts): rejects function declarations nested in blocks.
- [`noIrregularWhitespace`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-irregular-whitespace.ts): rejects irregular whitespace.
- [`noIterator`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-iterator.ts): rejects `__iterator__`.
- [`noLabels`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-labels.ts): rejects labels.
- [`noLoneBlocks`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-lone-blocks.ts): rejects unnecessary standalone blocks.
- [`noLonelyIf`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-lonely-if.ts): rejects `if` as the only statement in an `else`.
- [`noLossOfPrecision`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-loss-of-precision.ts): rejects number literals that lose precision.
- [`noMisleadingCharacterClass`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-misleading-character-class.ts): rejects misleading regex character classes.
- [`noMisusedNew`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-misused-new.ts): rejects constructor-like signatures in interfaces.
- [`noMixedEnums`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-mixed-enums.ts): rejects enums that mix numeric and string members.
- [`noMultiAssign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-multi-assign.ts): rejects chained assignments.
- [`noMultiStr`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-multi-str.ts): rejects multiline string escapes.
- [`noNamespace`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-namespace.ts): rejects non-ambient namespaces.
- [`noNegatedCondition`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-negated-condition.ts): rejects negated conditions with an `else`.
- [`noNestedTernary`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-nested-ternary.ts): rejects nested ternary expressions.
- [`noNew`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-new.ts): rejects `new` expressions used only for side effects.
- [`noNewFunc`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-new-func.ts): rejects `Function` constructors.
- [`noNewWrappers`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-new-wrappers.ts): rejects primitive wrapper constructors.
- [`noNonNullAssertedNullishCoalescing`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-non-null-asserted-nullish-coalescing.ts): rejects non-null assertions next to `??`.
- [`noNonNullAssertedOptionalChain`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-non-null-asserted-optional-chain.ts): rejects non-null assertions on optional chains.
- [`noNonNullAssertion`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-non-null-assertion.ts): rejects postfix non-null assertions.
- [`noObjCalls`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-obj-calls.ts): rejects calling global objects as functions.
- [`noObjectConstructor`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-object-constructor.ts): rejects `new Object()`.
- [`noOctal`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-octal.ts): rejects legacy octal literals.
- [`noOctalEscape`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-octal-escape.ts): rejects octal escape sequences.
- [`noPlusplus`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-plusplus.ts): rejects `++` and `--`.
- [`noPromiseExecutorReturn`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-promise-executor-return.ts): rejects returned values from Promise executors.
- [`noProto`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-proto.ts): rejects `__proto__`.
- [`noPrototypeBuiltins`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-prototype-builtins.ts): rejects direct `Object.prototype` method calls.
- [`noRegexSpaces`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-regex-spaces.ts): rejects repeated literal spaces in regexes.
- [`noRequireImports`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-require-imports.ts): rejects CommonJS `require` imports.
- [`noReturnAssign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-return-assign.ts): rejects assignments in `return`.
- [`noScriptUrl`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-script-url.ts): rejects `javascript:` URLs.
- [`noSelfAssign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-self-assign.ts): rejects assignments to the same value.
- [`noSelfCompare`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-self-compare.ts): rejects comparing a value to itself.
- [`noSequences`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-sequences.ts): rejects comma expressions.
- [`noSetterReturn`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-setter-return.ts): rejects returned values from setters.
- [`noShadowRestrictedNames`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-shadow-restricted-names.ts): rejects shadowing restricted globals.
- [`noSparseArrays`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-sparse-arrays.ts): rejects sparse arrays.
- [`noTemplateCurlyInString`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-template-curly-in-string.ts): rejects `${...}` text inside normal strings.
- [`noThisAlias`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-this-alias.ts): rejects aliasing `this` to locals.
- [`noThrowLiteral`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-throw-literal.ts): rejects throwing literals.
- [`noUndefInit`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-undef-init.ts): rejects initializing to `undefined`.
- [`noUndefined`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-undefined.ts): rejects the global `undefined` identifier.
- [`noUnnecessaryTypeConstraint`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unnecessary-type-constraint.ts): rejects redundant `extends any` and `extends unknown` constraints.
- [`noUnneededTernary`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unneeded-ternary.ts): rejects redundant ternary expressions.
- [`noUnsafeDeclarationMerging`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unsafe-declaration-merging.ts): rejects unsafe class/interface declaration merging.
- [`noUnsafeFinally`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unsafe-finally.ts): rejects control flow from `finally`.
- [`noUnsafeFunctionType`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unsafe-function-type.ts): rejects the unsafe `Function` type.
- [`noUnsafeNegation`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unsafe-negation.ts): rejects unsafe negation before relational checks.
- [`noUnusedExpressions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unused-expressions.ts): rejects expression statements with no effect.
- [`noUnusedLabels`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unused-labels.ts): rejects labels that no `break` or `continue` targets.
- [`noUselessCall`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-call.ts): rejects unnecessary `.call()` and `.apply()`.
- [`noUselessCatch`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-catch.ts): rejects catch blocks that only rethrow.
- [`noUselessComputedKey`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-computed-key.ts): rejects unnecessary computed property keys.
- [`noUselessConcat`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-concat.ts): rejects unnecessary string concatenation.
- [`noUselessConstructor`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-constructor.ts): rejects empty constructors with no parameters.
- [`noUselessEscape`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-escape.ts): rejects backslash escapes that have no effect inside strings or regexes.
- [`noUselessRename`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-rename.ts): rejects import/export/destructure renames to the same name.
- [`noVar`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-var.ts): rejects `var`.
- [`noWith`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-with.ts): rejects `with` statements.
- [`noWrapperObjectTypes`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-wrapper-object-types.ts): rejects boxed object type names such as `String` and `Boolean`.
- [`objectShorthand`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/object-shorthand.ts): requires object property shorthand where possible.
- [`operatorAssignment`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/operator-assignment.ts): prefers compound assignment operators.
- [`preferAsConst`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-as-const.ts): prefers `as const` for literal assertions.
- [`preferConst`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-const.ts): prefers `const` for `let` bindings that are never reassigned.
- [`preferEnumInitializers`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-enum-initializers.ts): requires explicit enum member initializers.
- [`preferExponentiationOperator`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-exponentiation-operator.ts): prefers `**` over `Math.pow`.
- [`preferForOf`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-for-of.ts): prefers `for...of` for simple array iteration.
- [`preferFunctionType`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-function-type.ts): prefers function type aliases over single-call interfaces.
- [`preferLiteralEnumMember`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-literal-enum-member.ts): prefers literal enum member initializers over computed expressions.
- [`preferNamespaceKeyword`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-namespace-keyword.ts): prefers `namespace` over TypeScript's legacy `module` keyword.
- [`preferSpread`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-spread.ts): prefers spread arguments over `.apply`.
- [`preferTemplate`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-template.ts): prefers template literals over string concatenation.
- [`radix`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/radix.ts): requires a radix argument for `parseInt`.
- [`requireYield`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/require-yield.ts): requires generator functions to contain `yield`.
- [`tripleSlashReference`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/triple-slash-reference/violation.ts): rejects triple-slash reference directives.
- [`useIsNaN`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/use-isnan.ts): requires `Number.isNaN`/`isNaN` for `NaN` checks.
- [`validTypeof`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/valid-typeof.ts): restricts `typeof` comparisons to valid strings.
- [`varsOnTop`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/vars-on-top.ts): requires `var` declarations at the top of their scope.
- [`yoda`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/yoda.ts): rejects literal-first comparisons.

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
