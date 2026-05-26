# `@ttsc/lint`

![banner of @ttsc/lint](https://ttsc.dev/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE)
[![NPM Version](https://img.shields.io/npm/v/@ttsc/lint.svg)](https://www.npmjs.com/package/@ttsc/lint)
[![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/lint.svg)](https://www.npmjs.com/package/@ttsc/lint)
[![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest)
[![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs)
[![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

A linter and formatter. Co-protagonist of the [`ttsc`](https://ttsc.dev) toolchain — paired with `ttsc`, it replaces `eslint` and `prettier`.

150+ rules. Lint violations surface as `error TSxxxxx` from a single compile pass; the formatter applies via `ttsc format`.

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
    "no-explicit-any": "warning",
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
  rules: { "no-var": "error" },
} satisfies ITtscLintConfig;
```

Presence of the block (even empty `format: {}`) configures the always-on format rules at Prettier defaults for `ttsc format`. It does not make `ttsc check` fail on formatting by default; set `format.severity` only if you intentionally want check-time format diagnostics.

Each `format` key drives one rule:

| Rule | Driven by | Effect |
| --- | --- | --- |
| all format rules | `severity` (default `"off"`) | Optional check-time diagnostic severity. `ttsc format` still applies configured format rules when this is off. |
| `format/semi` | `semi` | Insert trailing semicolons on ASI-terminated statements. |
| `format/quotes` | `singleQuote` | Convert quoted strings to the preferred quote style. |
| `format/trailing-comma` | `trailingComma` | Add trailing commas to multi-line lists. |
| `format/print-width` | `printWidth`, `tabWidth`, `useTabs`, `endOfLine` | Column-aware line reflow. Object/array literals, call/new arguments, and named import/export clauses break across lines when their flat form overflows the budget. |
| `format/sort-imports` | `importOrder` (opt-in) | Group external/relative imports and alphabetize each group + its specifiers. |
| `format/jsdoc` | `jsdoc` (opt-in) | Normalize JSDoc blocks toward [prettier-plugin-jsdoc](https://github.com/hosseinmd/prettier-plugin-jsdoc). |

`format/sort-imports` and `format/jsdoc` are **opt-in**: they only run when you set their `format` keys. Every other format rule is available to `ttsc format` as soon as a `format` block is present.

To disable or override one specific format rule, drop a sibling `rules` entry — `rules` wins on conflict:

```ts
export default {
  format: { severity: "warning", semi: true },
  rules: { "format/semi": "off" },
} satisfies ITtscLintConfig;
```

### Functional policy

The `functional/*` rules are an opt-in strictness pack for immutable,
expression-oriented TypeScript. They are diagnostic-only: `ttsc fix` does not
rewrite mutation, classes, exceptions, loops, or branching into a functional
design.

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
### Architecture boundaries

The `boundaries/*` rules implement a conservative TypeScript source-path subset inspired by `eslint-plugin-boundaries`: static `import` and `export ... from` specifiers are resolved to source files, then classified with per-rule `elements` options.

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

Boundary diagnostics do not offer autofixes. A violation usually needs an API or architecture decision, not a mechanical import rewrite.

### Rules

Rules are off until you enable them:

```ts
// lint.config.ts
export default {
  rules: {
    "no-var": "error",
    "eqeqeq": "error",
    "prefer-template": "warning",
    "no-non-null-assertion": "off",
  },
} satisfies ITtscLintConfig;
```

Vitest source rules use the `vitest/*` namespace. The native set focuses on
high-confidence AST checks shared with Jest-style test linting: focused or
disabled tests, duplicate titles, missing or conditional assertions, standalone
`expect` calls, done callbacks, invalid `expect` chains, invalid titles,
returned test values, and `.length` assertions that should use `toHaveLength`.

Most rule corpus cases live in `tests/test-lint/src/cases/*.ts`; source-path and engine-focused families with package-local Go coverage, such as `boundaries/*` and `security/*`, link to their Go tests. Each rule below links to its tested fixture where one exists:

Storybook projects can enable the `storybook/*` family on `*.stories.ts(x)` and `.storybook/main.ts` files. It covers CSF metadata shape, named story exports, deprecated `storiesOf`, interaction-test imports, direct renderer-package imports, and addon installation checks. `storybook/no-uninstalled-addons` accepts `{ packageJsonLocation?: string; ignore?: string[] }`; without an explicit path it walks upward from the linted Storybook config file to find `package.json`.

### Testing Library

`@ttsc/lint` also ships the `testing-library/*` family from `eslint-plugin-testing-library` for TS/TSX test files. These rules are AST-only and report only after a Testing Library import is present in the file.

- `testing-library/await-async-events`, `testing-library/await-async-queries`, `testing-library/await-async-utils`: require handling Promise-returning user-event methods, `findBy*` queries, and async utilities.
- `testing-library/no-await-sync-events`, `testing-library/no-await-sync-queries`: reject unnecessary `await` on synchronous `fireEvent`, `getBy*`, and `queryBy*` calls.
- `testing-library/no-container`, `testing-library/no-node-access`, `testing-library/prefer-screen-queries`: prefer `screen.*` queries over container access, DOM traversal, and render-result query functions.
- `testing-library/no-debugging-utils`, `testing-library/no-dom-import`, `testing-library/no-manual-cleanup`, `testing-library/no-test-id-queries`: catch committed debug helpers, direct DOM package imports, manual cleanup, and test-id queries.
- `testing-library/no-wait-for-multiple-assertions`, `testing-library/no-wait-for-side-effects`, `testing-library/no-wait-for-snapshot`, `testing-library/prefer-find-by`, `testing-library/prefer-query-by-disappearance`: keep `waitFor` callbacks focused and prefer purpose-built queries.
- `testing-library/prefer-user-event`, `testing-library/prefer-user-event-setup`, `testing-library/no-promise-in-fire-event`, `testing-library/no-render-in-lifecycle`, `testing-library/no-unnecessary-act`: catch common event, render, and `act()` anti-patterns.
- `testing-library/consistent-data-testid`, `testing-library/prefer-explicit-assert`, `testing-library/prefer-implicit-assert`, `testing-library/prefer-presence-queries`, `testing-library/prefer-query-matchers`, `testing-library/render-result-naming-convention`: cover configured test-id naming, assertion style, presence matchers, and render result names.

### Solid

`@ttsc/lint` ships the `solid/*` family from `eslint-plugin-solid` for TSX source. These rules are AST-only and focus on high-confidence Solid patterns after a Solid import is present.

- `solid/reactivity`, `solid/no-destructure`, `solid/components-return-once`: catch common Solid reactivity breakages in components.
- `solid/jsx-no-undef`, `solid/jsx-no-duplicate-props`, `solid/jsx-no-script-url`, `solid/no-innerhtml`, `solid/no-unknown-namespaces`: guard JSX correctness and unsafe DOM attributes.
- `solid/event-handlers`, `solid/no-array-handlers`, `solid/no-react-specific-props`: keep DOM event and prop shapes aligned with Solid rather than React.
- `solid/imports`, `solid/no-react-deps`, `solid/no-proxy-apis`: enforce canonical Solid imports and non-React/non-Proxy call patterns.
- `solid/prefer-for`, `solid/prefer-show`, `solid/prefer-classlist`, `solid/self-closing-comp`, `solid/style-prop`: cover Solid rendering and style preferences.
- `solid/jsx-uses-vars`: accepted for config compatibility; it does not emit native diagnostics because @ttsc/lint does not implement ESLint's unused-variable marker pass.

- [`adjacent-overload-signatures`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/adjacent-overload-signatures.ts): keeps overload declarations for the same member adjacent.
- [`array-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/array-type.ts): prefers `T[]` and `readonly T[]` over array helper types.
- [`await-thenable`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/await-thenable.ts): rejects `await` on a value that is neither a Promise nor a thenable (type-aware).
- [`ban-ts-comment`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/ban-ts-comment.ts): rejects TypeScript suppression comments such as `@ts-ignore`.
- [`ban-tslint-comment`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/ban-tslint-comment.ts): rejects obsolete `tslint:` comments.
- [`boundaries/element-types`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/boundaries/boundaries_element_types_rejects_disallowed_import_test.go): enforces allowed dependency directions between configured source-path element types.
- [`boundaries/entry-point`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/boundaries/boundaries_entry_point_rejects_non_entry_import_test.go): requires imports into an element to target its configured public entry files.
- [`boundaries/external`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/boundaries/boundaries_external_rejects_disallowed_package_test.go): restricts external package imports by package/specifier pattern.
- [`boundaries/no-private`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/boundaries/boundaries_no_private_rejects_cross_element_private_import_test.go): rejects imports of configured private files from outside their element.
- [`boundaries/no-unknown`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/boundaries/boundaries_no_unknown_rejects_unknown_import_target_test.go): rejects relative imports whose resolved source file matches no configured element.
- `cypress/assertion-before-screenshot`: requires a Cypress assertion before `cy.screenshot()`.
- `cypress/no-and`: prefers `.should()` over `.and()` when starting Cypress assertion chains.
- `cypress/no-assigning-return-values`: rejects assigning the return value of Cypress commands.
- `cypress/no-async-before`: rejects async `before` and `beforeEach` callbacks.
- `cypress/no-async-tests`: rejects async Cypress test callbacks.
- `cypress/no-chained-get`: rejects chained `.get()` calls.
- `cypress/no-debug`: rejects `cy.debug()` and chained `.debug()` commands.
- `cypress/no-force`: rejects `{ force: true }` on Cypress action commands.
- `cypress/no-pause`: rejects `cy.pause()` and chained `.pause()` commands.
- `cypress/no-unnecessary-waiting`: rejects numeric `cy.wait(...)` sleeps.
- `cypress/no-xpath`: rejects deprecated `cy.xpath()` selectors.
- `cypress/require-data-selectors`: requires statically known `cy.get()` selectors to target `data-*` attributes.
- `cypress/unsafe-to-chain-command`: rejects chaining more commands after Cypress action commands.
- `eslint-comments/disable-enable-pair`: requires range `eslint-disable` directives to be paired with `eslint-enable`.
- `eslint-comments/no-aggregating-enable`: rejects bare `eslint-enable` comments that re-enable named disables at once.
- `eslint-comments/no-duplicate-disable`: rejects repeated disables for a rule that is already disabled.
- `eslint-comments/no-restricted-disable`: rejects disables for configured protected rules.
- `eslint-comments/no-unlimited-disable`: rejects disable comments with no explicit rule list.
- `eslint-comments/no-unused-disable`: rejects disable comments that suppress no diagnostic.
- `eslint-comments/no-unused-enable`: rejects enable comments that do not re-enable anything.
- `eslint-comments/no-use`: rejects lint directive comments entirely.
- `eslint-comments/require-description`: requires directive comments to include a `--` description.
- [`consistent-indexed-object-style`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/consistent-indexed-object-style.ts): prefers `Record` for single index-signature object types.
- [`consistent-type-assertions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/consistent-type-assertions.ts): prefers `as` type assertions over angle-bracket assertions.
- [`consistent-type-definitions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/consistent-type-definitions.ts): prefers interfaces for object-shaped type definitions.
- [`consistent-type-imports`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/consistent-type-imports/violation.ts): uses `import type` when imported names are type-only.
- [`default-param-last`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/default-param-last.ts): keeps parameters with default values at the end of the list.
- [`dot-notation`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/dot-notation.ts): prefers dot property access when a string-literal key is a valid identifier.
- [`eqeqeq`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/eqeqeq.ts): requires strict equality operators.
- [`for-direction`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/for-direction.ts): catches loop counters updated in the wrong direction.
- [`functional/functional-parameters`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_parameters_rejects_rest_parameter_test.go): rejects rest parameters, `arguments`, and optionally zero-parameter functions.
- [`functional/immutable-data`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_immutable_data_rejects_property_assignment_test.go): rejects writes through object/array members and mutable collection methods.
- [`functional/no-class-inheritance`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_no_class_inheritance_rejects_extends_test.go): rejects class inheritance and abstract classes.
- [`functional/no-classes`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_no_classes_rejects_class_declaration_test.go): rejects class declarations and expressions.
- [`functional/no-conditional-statements`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_no_conditional_statements_rejects_if_test.go): rejects `if` and `switch` statements.
- [`functional/no-expression-statements`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_no_expression_statements_rejects_call_test.go): rejects expression statements used for side effects.
- [`functional/no-let`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_no_let_rejects_let_declaration_test.go): rejects `let` declarations.
- [`functional/no-loop-statements`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_no_loop_statements_rejects_for_test.go): rejects imperative loop statements.
- [`functional/no-mixed-types`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_no_mixed_types_rejects_method_and_property_test.go): rejects type/interface declarations that mix member shapes.
- [`functional/no-promise-reject`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_no_promise_reject_rejects_static_call_test.go): rejects `Promise.reject(...)`.
- [`functional/no-return-void`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_no_return_void_rejects_void_return_test.go): rejects void returns and void-returning declarations.
- [`functional/no-this-expressions`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_no_this_expressions_rejects_this_test.go): rejects `this` expressions.
- [`functional/no-throw-statements`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_no_throw_statements_rejects_throw_test.go): rejects `throw` statements.
- [`functional/no-try-statements`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_no_try_statements_rejects_catch_test.go): rejects `try`/`catch`/`finally` statements.
- [`functional/prefer-immutable-types`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_prefer_immutable_types_rejects_mutable_parameter_array_test.go): prefers readonly/immutable type annotations.
- [`functional/prefer-property-signatures`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_prefer_property_signatures_rejects_method_signature_test.go): prefers function-property signatures over method signatures.
- [`functional/prefer-readonly-type`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_prefer_readonly_type_rejects_array_type_test.go): requires readonly array, tuple, and property type syntax.
- [`functional/prefer-tacit`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_prefer_tacit_rejects_trivial_wrapper_test.go): reports simple one-argument forwarding wrappers.
- [`functional/readonly-type`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_readonly_type_rejects_readonly_array_generic_test.go): enforces the configured readonly type spelling.
- [`functional/type-declaration-immutability`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/functional/functional_type_declaration_immutability_rejects_mutable_interface_test.go): requires matching type declarations to expose readonly member shapes.
- [`method-signature-style`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/method-signature-style.ts): prefers function-property signatures over method shorthand signatures.
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
- [`no-unnecessary-parameter-property-assignment`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unnecessary-parameter-property-assignment.ts): rejects constructor assignments already handled by parameter properties.
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
- [`no-useless-empty-export`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-empty-export.ts): rejects redundant empty `export {}` declarations in module files.
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
- [`react-refresh/only-export-components`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/react-refresh/only_export_components_reports_non_component_export_test.go): keeps React Fast Refresh component modules from exporting non-components.
- [`require-yield`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/require-yield.ts): requires generator functions to contain `yield`.
- [`triple-slash-reference`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/triple-slash-reference/violation.ts): rejects triple-slash reference directives.
- [`use-isnan`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/use-isnan.ts): requires `Number.isNaN`/`isNaN` for `NaN` checks.
- [`valid-typeof`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/valid-typeof.ts): restricts `typeof` comparisons to valid strings.
- [`vars-on-top`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/vars-on-top.ts): requires `var` declarations at the top of their scope.
- [`yoda`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/yoda.ts): rejects literal-first comparisons.
- [`tsdoc/syntax`](https://github.com/samchon/ttsc/blob/master/packages/lint/test/rules/comments-directives/tsdoc_syntax_test.go): validates malformed TSDoc block tags and inline tags in `/** ... */` comments.

### Security rules

The `security/*` family ports the TypeScript-source-relevant `eslint-plugin-security@4.0.0` surface:

- `security/detect-bidi-characters`: detects Trojan Source bidi control characters.
- `security/detect-buffer-noassert`: detects Buffer reads/writes with `noAssert` set to true.
- `security/detect-child-process`: detects child_process imports and non-literal `exec` commands.
- `security/detect-disable-mustache-escape`: detects `escapeMarkup = false` on objects.
- `security/detect-eval-with-expression`: detects `eval` fed by non-literal expressions.
- `security/detect-new-buffer`: detects `new Buffer` with non-literal input.
- `security/detect-no-csrf-before-method-override`: detects Express csrf middleware before methodOverride.
- `security/detect-non-literal-fs-filename`: detects filesystem calls with non-literal filename arguments.
- `security/detect-non-literal-regexp`: detects RegExp construction from non-literal patterns.
- `security/detect-non-literal-require`: detects `require` calls with non-literal module specifiers.
- `security/detect-object-injection`: detects dynamic bracket access sinks.
- `security/detect-possible-timing-attacks`: detects direct equality comparisons involving secret-like identifiers.
- `security/detect-pseudoRandomBytes`: detects `crypto.pseudoRandomBytes`.
- `security/detect-unsafe-regex`: detects high-confidence catastrophic backtracking regex shapes.

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
