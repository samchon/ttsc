# `@ttsc/lint`

![banner of @ttsc/lint](https://raw.githubusercontent.com/samchon/ttsc/refs/heads/master/assets/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE)
[![NPM Version](https://img.shields.io/npm/v/@ttsc/lint.svg)](https://www.npmjs.com/package/@ttsc/lint)
[![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/lint.svg)](https://www.npmjs.com/package/@ttsc/lint)
[![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest)
[![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://github.com/samchon/ttsc/tree/master/docs)
[![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

`@ttsc/lint` reports ESLint-style diagnostics from the same TypeScript-Go type-check pass that `ttsc` already runs.

## Setup

Install `ttsc`, TypeScript-Go, and the lint plugin:

```bash
npm install -D ttsc @typescript/native-preview @ttsc/lint
```

Open your project's `tsconfig.json`, then add this entry under `compilerOptions.plugins`. If the file already has `compilerOptions`, merge this into the existing object and keep `@ttsc/lint` as the first active plugin:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@ttsc/lint",
        "config": {
          "no-var": "error",
          "prefer-const": "error",
          "no-explicit-any": "warning",
          "no-console": "off"
        }
      }
    ]
  }
}
```

Run your normal `ttsc` or `ttsx` command:

```bash
npx ttsc
npx ttsx src/index.ts
```

Lint errors fail the command. With `ttsx`, lint errors stop the program before your entrypoint runs. Lint warnings are printed without changing the exit code.

You can also keep the lint rules in a standalone config file and leave only the file reference in `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@ttsc/lint",
        "config": "./ttsc-lint.config.ts"
      }
    ]
  }
}
```

```ts
// ttsc-lint.config.ts
export default {
  "no-var": "error",
  "prefer-const": "error",
  "no-explicit-any": "warning",
  "no-console": "off"
};
```

`config` accepts either a config object or a path to `.json`, `.js`, `.cjs`, `.mjs`, `.ts`, `.cts`, or `.mts`. JavaScript and TypeScript config files may export the object directly, as `default`, as `config`, or as a function that returns the object. Relative paths are resolved from the owning tsconfig directory.

Inline `config` is also accepted:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@ttsc/lint",
        "config": {
          "no-var": "error"
        }
      }
    ]
  }
}
```

## Notes

`@ttsc/lint` must be the first active plugin entry because it reports on the source code you wrote. Output plugins such as `@ttsc/banner`, `@ttsc/paths`, and `@ttsc/strip` can come after it.

```jsonc
{
  "compilerOptions": {
    "plugins": [
      // Keep lint first.
      { "transform": "@ttsc/lint", "config": { "no-var": "error", "prefer-const": "error" } },

      // Output plugins run after emit, in order.
      { "transform": "@ttsc/banner", "banner": "/*! @license MIT */" },
      { "transform": "@ttsc/paths" },
      { "transform": "@ttsc/strip", "calls": ["console.log"] }
    ]
  }
}
```

This package is diagnostic-only today: no autofix, no recommended preset, no custom rule loading, and no cross-file lint rules.

## Rules

Rules are off until you enable them:

```jsonc
{
  "no-var": "error",
  "eqeqeq": "error",
  "prefer-template": "warning",
  "no-non-null-assertion": "off"
}
```

Rule severities are `"error"`, `"warning"`, and `"off"`.

The rule corpus is tested in `tests/lint/cases/*.ts`, which is the best place to check the exact patterns currently covered. Each rule below links to its tested fixture:

- [`adjacent-overload-signatures`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/adjacent-overload-signatures.ts): keeps overload declarations for the same member adjacent.
- [`array-type`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/array-type.ts): prefers `T[]` and `readonly T[]` over array helper types.
- [`ban-ts-comment`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/ban-ts-comment.ts): rejects TypeScript suppression comments such as `@ts-ignore`.
- [`ban-tslint-comment`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/ban-tslint-comment.ts): rejects obsolete `tslint:` comments.
- [`consistent-indexed-object-style`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/consistent-indexed-object-style.ts): prefers `Record` for single index-signature object types.
- [`consistent-type-assertions`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/consistent-type-assertions.ts): prefers `as` type assertions over angle-bracket assertions.
- [`consistent-type-definitions`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/consistent-type-definitions.ts): prefers interfaces for object-shaped type definitions.
- [`consistent-type-imports`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/consistent-type-imports/violation.ts): uses `import type` when imported names are type-only.
- [`dot-notation`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/dot-notation.ts): prefers dot property access when a string-literal key is a valid identifier.
- [`eqeqeq`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/eqeqeq.ts): requires strict equality operators.
- [`for-direction`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/for-direction.ts): catches loop counters updated in the wrong direction.
- [`no-alert`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-alert.ts): rejects `alert`, `confirm`, and `prompt`.
- [`no-array-constructor`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-array-constructor.ts): rejects `Array` constructor calls.
- [`no-array-delete`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-array-delete.ts): rejects `delete` on array elements.
- [`no-async-promise-executor`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-async-promise-executor.ts): rejects async Promise executors.
- [`no-bitwise`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-bitwise.ts): rejects bitwise operators.
- [`no-caller`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-caller.ts): rejects `arguments.caller` and `arguments.callee`.
- [`no-case-declarations`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-case-declarations.ts): rejects lexical declarations directly inside `case` clauses.
- [`no-class-assign`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-class-assign.ts): rejects reassignment of class declarations.
- [`no-compare-neg-zero`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-compare-neg-zero.ts): rejects comparisons against `-0`.
- [`no-cond-assign`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-cond-assign.ts): rejects assignments inside conditions.
- [`no-confusing-non-null-assertion`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-confusing-non-null-assertion.ts): rejects confusing non-null assertions next to equality checks.
- [`no-console`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-console.ts): rejects `console` calls.
- [`no-constant-condition`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-constant-condition.ts): rejects constant conditions.
- [`no-continue`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-continue.ts): rejects `continue` statements.
- [`no-control-regex`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-control-regex.ts): rejects control characters in regular expressions.
- [`no-debugger`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-debugger.ts): rejects `debugger` statements.
- [`no-delete-var`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-delete-var.ts): rejects deleting variables.
- [`no-dupe-args`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-dupe-args.ts): rejects duplicate function parameters.
- [`no-dupe-else-if`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-dupe-else-if.ts): rejects repeated `else if` conditions.
- [`no-dupe-keys`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-dupe-keys.ts): rejects duplicate object keys.
- [`no-duplicate-case`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-duplicate-case.ts): rejects duplicate `switch` case labels.
- [`no-duplicate-enum-values`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-duplicate-enum-values.ts): rejects duplicate enum member values.
- [`no-dynamic-delete`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-dynamic-delete.ts): rejects `delete` on dynamically computed property keys.
- [`no-empty`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-empty.ts): rejects empty blocks.
- [`no-empty-character-class`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-empty-character-class.ts): rejects empty regex character classes.
- [`no-empty-function`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-empty-function.ts): rejects empty functions.
- [`no-empty-interface`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-empty-interface.ts): rejects empty interfaces.
- [`no-empty-object-type`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-empty-object-type.ts): rejects empty object type literals.
- [`no-empty-pattern`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-empty-pattern.ts): rejects empty destructuring patterns.
- [`no-empty-static-block`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-empty-static-block.ts): rejects empty class static blocks.
- [`no-eq-null`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-eq-null.ts): rejects loose null comparisons.
- [`no-eval`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-eval.ts): rejects `eval`.
- [`no-ex-assign`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-ex-assign.ts): rejects reassignment of caught exceptions.
- [`no-explicit-any`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-explicit-any.ts): rejects explicit `any`.
- [`no-extra-bind`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-extra-bind.ts): rejects unnecessary `.bind()` calls.
- [`no-extra-boolean-cast`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-extra-boolean-cast.ts): rejects redundant boolean casts.
- [`no-extra-non-null-assertion`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-extra-non-null-assertion.ts): rejects repeated non-null assertions.
- [`no-fallthrough`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-fallthrough.ts): rejects unmarked `switch` fallthrough.
- [`no-func-assign`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-func-assign.ts): rejects reassignment of function declarations.
- [`no-inferrable-types`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-inferrable-types.ts): rejects type annotations TypeScript can infer.
- [`no-inner-declarations`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-inner-declarations.ts): rejects function declarations nested in blocks.
- [`no-irregular-whitespace`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-irregular-whitespace.ts): rejects irregular whitespace.
- [`no-iterator`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-iterator.ts): rejects `__iterator__`.
- [`no-labels`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-labels.ts): rejects labels.
- [`no-lone-blocks`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-lone-blocks.ts): rejects unnecessary standalone blocks.
- [`no-lonely-if`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-lonely-if.ts): rejects `if` as the only statement in an `else`.
- [`no-loss-of-precision`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-loss-of-precision.ts): rejects number literals that lose precision.
- [`no-misleading-character-class`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-misleading-character-class.ts): rejects misleading regex character classes.
- [`no-misused-new`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-misused-new.ts): rejects constructor-like signatures in interfaces.
- [`no-multi-assign`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-multi-assign.ts): rejects chained assignments.
- [`no-multi-str`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-multi-str.ts): rejects multiline string escapes.
- [`no-namespace`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-namespace.ts): rejects non-ambient namespaces.
- [`no-negated-condition`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-negated-condition.ts): rejects negated conditions with an `else`.
- [`no-nested-ternary`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-nested-ternary.ts): rejects nested ternary expressions.
- [`no-new`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-new.ts): rejects `new` expressions used only for side effects.
- [`no-new-func`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-new-func.ts): rejects `Function` constructors.
- [`no-new-wrappers`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-new-wrappers.ts): rejects primitive wrapper constructors.
- [`no-non-null-asserted-nullish-coalescing`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-non-null-asserted-nullish-coalescing.ts): rejects non-null assertions next to `??`.
- [`no-non-null-asserted-optional-chain`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-non-null-asserted-optional-chain.ts): rejects non-null assertions on optional chains.
- [`no-non-null-assertion`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-non-null-assertion.ts): rejects postfix non-null assertions.
- [`no-obj-calls`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-obj-calls.ts): rejects calling global objects as functions.
- [`no-object-constructor`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-object-constructor.ts): rejects `new Object()`.
- [`no-octal`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-octal.ts): rejects legacy octal literals.
- [`no-octal-escape`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-octal-escape.ts): rejects octal escape sequences.
- [`no-plusplus`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-plusplus.ts): rejects `++` and `--`.
- [`no-promise-executor-return`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-promise-executor-return.ts): rejects returned values from Promise executors.
- [`no-proto`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-proto.ts): rejects `__proto__`.
- [`no-prototype-builtins`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-prototype-builtins.ts): rejects direct `Object.prototype` method calls.
- [`no-regex-spaces`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-regex-spaces.ts): rejects repeated literal spaces in regexes.
- [`no-require-imports`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-require-imports.ts): rejects CommonJS `require` imports.
- [`no-return-assign`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-return-assign.ts): rejects assignments in `return`.
- [`no-script-url`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-script-url.ts): rejects `javascript:` URLs.
- [`no-self-assign`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-self-assign.ts): rejects assignments to the same value.
- [`no-self-compare`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-self-compare.ts): rejects comparing a value to itself.
- [`no-sequences`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-sequences.ts): rejects comma expressions.
- [`no-setter-return`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-setter-return.ts): rejects returned values from setters.
- [`no-shadow-restricted-names`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-shadow-restricted-names.ts): rejects shadowing restricted globals.
- [`no-sparse-arrays`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-sparse-arrays.ts): rejects sparse arrays.
- [`no-template-curly-in-string`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-template-curly-in-string.ts): rejects `${...}` text inside normal strings.
- [`no-this-alias`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-this-alias.ts): rejects aliasing `this` to locals.
- [`no-throw-literal`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-throw-literal.ts): rejects throwing literals.
- [`no-undef-init`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-undef-init.ts): rejects initializing to `undefined`.
- [`no-undefined`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-undefined.ts): rejects the global `undefined` identifier.
- [`no-unnecessary-type-constraint`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-unnecessary-type-constraint.ts): rejects redundant `extends any` and `extends unknown` constraints.
- [`no-unneeded-ternary`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-unneeded-ternary.ts): rejects redundant ternary expressions.
- [`no-unsafe-declaration-merging`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-unsafe-declaration-merging.ts): rejects unsafe class/interface declaration merging.
- [`no-unsafe-finally`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-unsafe-finally.ts): rejects control flow from `finally`.
- [`no-unsafe-function-type`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-unsafe-function-type.ts): rejects the unsafe `Function` type.
- [`no-unsafe-negation`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-unsafe-negation.ts): rejects unsafe negation before relational checks.
- [`no-unused-expressions`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-unused-expressions.ts): rejects expression statements with no effect.
- [`no-unused-labels`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-unused-labels.ts): rejects labels that no `break` or `continue` targets.
- [`no-useless-call`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-useless-call.ts): rejects unnecessary `.call()` and `.apply()`.
- [`no-useless-catch`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-useless-catch.ts): rejects catch blocks that only rethrow.
- [`no-useless-computed-key`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-useless-computed-key.ts): rejects unnecessary computed property keys.
- [`no-useless-concat`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-useless-concat.ts): rejects unnecessary string concatenation.
- [`no-useless-constructor`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-useless-constructor.ts): rejects empty constructors with no parameters.
- [`no-useless-rename`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-useless-rename.ts): rejects import/export/destructure renames to the same name.
- [`no-var`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-var.ts): rejects `var`.
- [`no-with`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-with.ts): rejects `with` statements.
- [`no-wrapper-object-types`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/no-wrapper-object-types.ts): rejects boxed object type names such as `String` and `Boolean`.
- [`object-shorthand`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/object-shorthand.ts): requires object property shorthand where possible.
- [`operator-assignment`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/operator-assignment.ts): prefers compound assignment operators.
- [`prefer-as-const`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/prefer-as-const.ts): prefers `as const` for literal assertions.
- [`prefer-const`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/prefer-const.ts): prefers `const` for `let` bindings that are never reassigned.
- [`prefer-enum-initializers`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/prefer-enum-initializers.ts): requires explicit enum member initializers.
- [`prefer-exponentiation-operator`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/prefer-exponentiation-operator.ts): prefers `**` over `Math.pow`.
- [`prefer-for-of`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/prefer-for-of.ts): prefers `for...of` for simple array iteration.
- [`prefer-function-type`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/prefer-function-type.ts): prefers function type aliases over single-call interfaces.
- [`prefer-literal-enum-member`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/prefer-literal-enum-member.ts): prefers literal enum member initializers over computed expressions.
- [`prefer-namespace-keyword`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/prefer-namespace-keyword.ts): prefers `namespace` over TypeScript's legacy `module` keyword.
- [`prefer-spread`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/prefer-spread.ts): prefers spread arguments over `.apply`.
- [`prefer-template`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/prefer-template.ts): prefers template literals over string concatenation.
- [`radix`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/radix.ts): requires a radix argument for `parseInt`.
- [`require-yield`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/require-yield.ts): requires generator functions to contain `yield`.
- [`triple-slash-reference`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/triple-slash-reference/violation.ts): rejects triple-slash reference directives.
- [`use-isnan`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/use-isnan.ts): requires `Number.isNaN`/`isNaN` for `NaN` checks.
- [`valid-typeof`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/valid-typeof.ts): restricts `typeof` comparisons to valid strings.
- [`vars-on-top`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/vars-on-top.ts): requires `var` declarations at the top of their scope.
- [`yoda`](https://github.com/samchon/ttsc/blob/master/tests/lint/cases/yoda.ts): rejects literal-first comparisons.
