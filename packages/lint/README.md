# `@ttsc/lint`

![banner of @ttsc/lint](https://ttsc.dev/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/@ttsc/lint.svg)](https://www.npmjs.com/package/@ttsc/lint) [![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/lint.svg)](https://www.npmjs.com/package/@ttsc/lint) [![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest) [![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

A linter and formatter. Co-protagonist of the [`ttsc`](https://ttsc.dev) toolchain, paired with `ttsc`, it replaces `eslint` and `prettier`.

720+ rules across 21 families. Lint violations surface as `error TSxxxxx` from a single compile pass; the formatter applies via `ttsc format`.

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

## Diagnostic code compatibility

Every built-in rule has a unique positive numeric code in the reserved `TS9000` through `TS17999` band. These assignments are kept in an append-only ledger: adding a built-in rule does not renumber existing rules, and a removed rule's code is not reused. The LSP surface continues to expose the rule ID, such as `no-var`, in its diagnostic `code` field.

The ledger introduction preserved every legacy code that was already unique. For each pre-existing collision group, the alphabetically first rule kept the shared legacy code and every other rule received an available code. Those resolved assignments are now frozen by the same append-only policy.

Rules contributed by another Go package share the same collision-free band. Their codes are deterministic for an unchanged complete set of loaded contributors and do not depend on registration order. Adding or removing a contributor recomputes assignments for that complete contributor set and can change contributor codes, but never changes a built-in assignment.

## Setup

```bash
npm install -D ttsc @ttsc/lint typescript
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
    "typescript/no-explicit-any": "error",
    "typescript/no-floating-promises": "error",
  },
} satisfies ITtscLintConfig;
```

Run your normal `ttsc` or `ttsx`:

```bash
npx ttsc
npx ttsx src/index.ts
```

Errors fail the command; warnings print without affecting the exit code. Under `ttsx`, errors stop the program before your entrypoint runs.

`ttsc fix` applies every autofix the enabled rules offer, lint and format together. Writes results back to disk, then re-runs type-check + lint. `ttsc format` runs the format rule set through the same dataflow.

```bash
npx ttsc fix
npx ttsc format
```

`ttsc fix` is a one-shot project pass and rejects `--watch`, single-file mode, and `--emit`. Fixes are written to disk before the recheck runs, so source stays modified even when the command exits non-zero on remaining errors. Recommended flow: run `ttsc fix` locally, commit, then have CI run `ttsc --noEmit` to gate on zero remaining errors.

## Format

Configure the formatter through the `format` block in `lint.config.ts`. Keys mirror `.prettierrc`; the presence of the block, even empty `format: {}`, enables the always-on format rules at Prettier defaults so `ttsc format` rewrites your source to match.

```ts
// lint.config.ts
import type { ITtscLintConfig } from "@ttsc/lint";

export default {
  format: {
    printWidth: 100,
    singleQuote: true,
    trailingComma: "all",
    sortImports: {
      order: ["<BUILTIN_MODULES>", "", "<THIRD_PARTY_MODULES>", "", "^[./]"],
      unsafeSortRuntimeImports: true, // accepts module evaluation reordering
    },
    jsDoc: true,
  },
  rules: { "no-var": "error" },
} satisfies ITtscLintConfig;
```

`ttsc check` does **not** fail on formatting by default. It surfaces format diagnostics only when you opt in with `format.severity`. `ttsc format` runs the active format rules across the project and writes results to disk regardless of `severity`.

Each `format` key controls one behavior:

| Config key | Effect |
| --- | --- |
| `severity` (default `"off"`) | Check-time diagnostic level for formatting. Does not gate `ttsc format`. |
| `semi` | Insert trailing semicolons on ASI-terminated statements. |
| `singleQuote` | Convert quoted strings to the preferred quote style. |
| `arrowParens` | Add or remove parens around a single arrow parameter. |
| `bracketSpacing` | Spaces inside object and named-import/export braces. |
| `quoteProps` | Quote or unquote object property keys. |
| `trailingComma` | Add trailing commas to multi-line lists. |
| `printWidth`, `tabWidth`, `useTabs`, `endOfLine` | Column-aware line reflow. Object/array literals, call/new arguments, and named import/export clauses break across lines when their flat form overflows the budget. |
| `sortImports` (opt-in) | Sort named specifiers and erased type-only imports. Runtime declaration sorting requires `unsafeSortRuntimeImports`. |
| `jsDoc` (on by default) | Normalize JSDoc blocks toward [prettier-plugin-jsdoc](https://github.com/hosseinmd/prettier-plugin-jsdoc). |

`sortImports` is **opt-in** — it takes effect only when you set it. Every other key takes effect as soon as the `format` block is present (JSDoc normalization included; set `jsDoc: false` to opt out), which also applies several keyless layout behaviors (statement splitting, indentation, whitespace normalization, clause joining, declaration-header reflow, ternary-nullish parens, leading-semicolon merging, and parameter-property breaking).

The safe default preserves the source order of every runtime-bearing import, including default, namespace, named, and bare imports, because each form can evaluate its dependency module. It still alphabetizes named specifiers within one declaration and can sort or merge a block made entirely of erased `import type` declarations. Set `unsafeSortRuntimeImports: true` only when every dependency in the block is order-independent. `combineTypeAndValue` affects a mixed type/value block only under that unsafe opt-in.

Formatting is configured **only** through the `format` block. The `rules` map is for lint rules; a `format/*` id placed there is ignored. To turn a format behavior off, set its `format` key (for example `trailingComma: "none"`), not a `rules` entry.

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

Rule IDs use ESLint-style kebab-case and slash namespaces, `no-var`, `react/jsx-key`, `testing-library/prefer-screen-queries`. The exported `ITtscLintRules` type is the intersection of family-specific interfaces such as `ITtscLintCoreRules`, `ITtscLintTypeScriptRules`, `ITtscLintReactRules`, and `ITtscLintVitestRules`, so users can type a whole config or a narrower family-shaped object.

Each rule below links to its TypeScript fixture under [`tests/test-lint/src/cases/`](https://github.com/samchon/ttsc/tree/master/tests/test-lint/src/cases).

<!--
AGENT INSTRUCTIONS, adding a new rule family or a new rule.

Family section shape (one `### <Family display name>` heading per family, alphabetical
by display name):

    ### <Family display name>

    <One-sentence summary of what this family covers, the "what".>

    <One short paragraph elaborating, the "why" / scope notes / known limits.>

    Source: [`<upstream-package>`](https://github.com/<org>/<repo>), [optional second source](https://…).

    - [`<rule-id>`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/<fixture-name>.ts): <short description ending in a period>.

Rules:

- Bullet shape is `- [\`<rule-id>\`](url): description.`: colon as separator, lowercase
  description, ending in a period. No em-dash separator. Bullets sort alphabetically
  by rule id within the family.
- The fixture path is `tests/test-lint/src/cases/<rule-id>.ts` for core rules,
  `tests/test-lint/src/cases/<family>-<rule-id>.ts(x)` for namespaced families
  (`.tsx` only when the snippet uses JSX). Create the fixture before linking.
- Do NOT put license parentheticals on the `Source:` line (e.g. ` (MIT)`,
  ` (BSD-3-Clause)`). Reader can click the link and see for themselves.
- Do NOT mention Go test files. Every bullet links to a `tests/test-lint/src/cases/`
  fixture; if a fixture does not exist yet, create one before adding the bullet.
- Update both this README **and** `website/src/content/docs/lint/rules/<family>.mdx`
  in the same change. The mdx file uses the same colon form (`- \`<rule-id>\`: <desc>.`)
  with no em-dashes; keep the rule list in sync between the two.
- After landing the bullet, append the upstream plugin link to the `## References`
  section below and update its `### Claim ownership` paragraph if a new family
  joined the family list.
-->

### ESLint core

Generic ESLint-compatible rules that apply to both JavaScript and TypeScript source. Every rule listed here corresponds 1-to-1 with an ESLint core rule of the same kebab-case id, so projects migrating from ESLint can paste their rule severities into `lint.config.ts` without renaming anything. TypeScript-only rules and `@typescript-eslint` extensions live under `typescript/*` in [TypeScript](#typescript), `@ttsc/lint` does not accept legacy bare names or `@typescript-eslint/*` aliases for those.

Source: [ESLint core rules](https://eslint.org/docs/latest/rules/).

- [`camelcase`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/camelcase.ts): reject identifier declarations that aren't camelCase or PascalCase, snake_case bindings are flagged.
- [`complexity`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/complexity.ts): reject function bodies whose cyclomatic complexity exceeds twenty (default ESLint threshold).
- [`consistent-return`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/consistent-return.ts): reject functions where some `return` statements return a value and others fall through without one.
- [`curly`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/curly.ts): require block statements for every `if`, `else`, `while`, `for`, and `do` body. Reject the single-statement shorthand.
- [`default-case`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/default-case.ts): require `switch` statements to include a `default` clause.
- [`default-case-last`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/default-case-last.ts): require the `default` clause of a `switch` statement to appear last.
- [`default-param-last`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/default-param-last.ts): keeps parameters with default values at the end of the list.
- [`dot-notation`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/dot-notation.ts): prefers dot property access when a string-literal key is a valid identifier.
- [`eqeqeq`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/eqeqeq.ts): requires strict equality operators.
- [`for-direction`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/for-direction.ts): catches loop counters updated in the wrong direction.
- [`getter-return`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/getter-return.ts): require a `get` accessor's body to return a value on every reachable exit.
- [`grouped-accessor-pairs`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/grouped-accessor-pairs.ts): require the `get` and `set` accessors of a property to be declared adjacent in the class body.
- [`guard-for-in`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/guard-for-in.ts): require `for...in` bodies to guard against inherited keys with `Object.hasOwn` or `Object.prototype.hasOwnProperty.call`.
- [`id-length`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/id-length.ts): reject identifier names shorter than two characters.
- [`init-declarations`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/init-declarations.ts): require every `var` / `let` declaration to be initialized at its declaration site.
- [`max-classes-per-file`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/max-classes-per-file.ts): reject a source file that declares more than one class.
- [`max-depth`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/max-depth.ts): reject block-statement nesting deeper than four levels inside a function.
- [`max-lines`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/max-lines.ts): reject a source file whose total line count exceeds three hundred.
- [`max-lines-per-function`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/max-lines-per-function.ts): reject a function whose body spans more than fifty lines.
- [`max-nested-callbacks`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/max-nested-callbacks.ts): reject callback nesting deeper than ten inside a single function.
- [`max-params`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/max-params.ts): reject function declarations with more than three parameters.
- [`max-statements`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/max-statements.ts): reject function bodies whose statement count exceeds ten.
- [`no-alert`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-alert.ts): rejects `alert`, `confirm`, and `prompt`.
- [`no-array-constructor`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-array-constructor.ts): rejects `Array` constructor calls.
- [`no-async-promise-executor`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-async-promise-executor.ts): rejects async Promise executors.
- [`no-await-in-loop`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-await-in-loop.ts): reject explicit and implicit awaits evaluated in repeated loop positions.
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
- [`no-dupe-else-if`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-dupe-else-if.ts): rejects duplicate or logically covered `else if` conditions.
- [`no-dupe-keys`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-dupe-keys.ts): rejects duplicate object keys.
- [`no-duplicate-case`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-duplicate-case.ts): rejects duplicate `switch` case labels.
- [`no-duplicate-imports`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-duplicate-imports.ts): reject a repeated module specifier when the import declarations could be merged into one; `allowSeparateTypeImports` and `includeExports` match the ESLint options.
- [`no-else-return`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-else-return.ts): reject an `else` block whose preceding `if` branch already terminates with `return`, `throw`, `break`, or `continue`.
- [`no-empty`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty.ts): rejects uncommented empty blocks and switches; `allowEmptyCatch` accepts empty catches.
- [`no-empty-character-class`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-character-class.ts): rejects empty regex character classes.
- [`no-empty-function`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-function.ts): rejects uncommented empty functions unless their category is allowed.
- [`no-empty-named-blocks`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-named-blocks.ts): rejects empty named import/export clauses (`import {} from "x"`, `export {}`).
- [`no-empty-pattern`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-pattern.ts): rejects empty destructuring patterns.
- [`no-empty-static-block`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-static-block.ts): rejects uncommented empty class static blocks.
- [`no-eq-null`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-eq-null.ts): rejects loose null comparisons.
- [`no-eval`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-eval.ts): rejects `eval`.
- [`no-ex-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-ex-assign.ts): rejects reassignment of caught exceptions.
- [`no-extend-native`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-extend-native.ts): reject assignments to a built-in prototype such as `Array.prototype.foo = bar`.
- [`no-extra-bind`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-extra-bind.ts): rejects `.bind(thisArg)` on arrows and regular functions that never read their own `this`, while preserving partial application.
- [`no-extra-boolean-cast`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-extra-boolean-cast.ts): rejects redundant boolean casts.
- [`no-fallthrough`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-fallthrough.ts): rejects `switch` cases whose end is reachable and that lack an intentional `// falls through` comment before the next label.
- [`no-func-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-func-assign.ts): rejects reassignment of function declarations.
- [`no-implicit-coercion`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-implicit-coercion.ts): reject common implicit-coercion idioms (`!!x`, `+x`, `"" + x`) in favor of the explicit `Boolean(x)` / `Number(x)` / `String(x)` conversions.
- [`no-import-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-import-assign.ts): resolves imported bindings through the checker and rejects assignments, destructuring and loop writes, plus direct namespace mutations such as `ns.x = ...` and `Object.assign(ns, value)`.
- [`no-inner-declarations`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-inner-declarations.ts): rejects block functions with legacy sloppy semantics; `"both"` also checks nested `var` declarations.
- [`no-invalid-this`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-invalid-this.ts): reject `this` references outside any function-like, class method, or class-static-block context.
- [`no-irregular-whitespace`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-irregular-whitespace.ts): rejects irregular whitespace.
- [`no-iterator`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-iterator.ts): rejects `__iterator__`.
- [`no-labels`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-labels.ts): rejects labels.
- [`no-lone-blocks`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-lone-blocks.ts): rejects unnecessary standalone blocks.
- [`no-lonely-if`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-lonely-if.ts): rejects `if` as the only statement in an `else`.
- [`no-loop-func`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-loop-func.ts): reject loop-created closures only when they capture bindings that can change between iterations.
- [`no-loss-of-precision`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-loss-of-precision.ts): rejects number literals that lose precision.
- [`no-magic-numbers`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-magic-numbers.ts): reject inline numeric literals outside `const` initializer position. `0`, `1`, `-1`, array indices, and enum values are exempt.
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
- [`no-param-reassign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-param-reassign.ts): rejects writes to parameter bindings, with `props` and property-ignore options matching ESLint.
- [`no-plusplus`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-plusplus.ts): rejects `++` and `--`.
- [`no-promise-executor-return`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-promise-executor-return.ts): rejects values returned by global Promise executors, with an `allowVoid` option for explicit unary `void` returns.
- [`no-proto`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-proto.ts): rejects `__proto__`.
- [`no-prototype-builtins`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-prototype-builtins.ts): rejects direct `Object.prototype` method calls.
- [`no-redeclare`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-redeclare.ts): rejects redeclaring a binding in the same scope.
- [`no-regex-spaces`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-regex-spaces.ts): rejects repeated literal spaces in regexes.
- [`no-restricted-imports`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-restricted-imports.ts): reject static imports and re-exports selected by user-configured exact paths, gitignore-style groups, or regular expressions.
- [`no-restricted-syntax`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-restricted-syntax.ts): reject only syntax matching the project's configured TypeScript-Go AST selectors; no selectors means no restrictions.
- [`no-return-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-return-assign.ts): rejects assignments in `return`.
- [`no-script-url`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-script-url.ts): rejects `javascript:` URLs.
- [`no-self-assign`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-self-assign.ts): rejects assignments to the same value.
- [`no-self-compare`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-self-compare.ts): rejects comparing a value to itself.
- [`no-sequences`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-sequences.ts): rejects comma expressions.
- [`no-setter-return`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-setter-return.ts): rejects returned values from setters.
- [`no-shadow`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-shadow.ts): reject a nested-scope binding that shadows a same-name binding from an outer scope.
- [`no-shadow-restricted-names`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-shadow-restricted-names.ts): rejects shadowing restricted globals.
- [`no-sparse-arrays`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-sparse-arrays.ts): rejects sparse arrays.
- [`no-template-curly-in-string`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-template-curly-in-string.ts): rejects `${...}` text inside normal strings.
- [`no-this-before-super`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-this-before-super.ts): reject `this` (or `super.x`) references that precede the first `super()` call in a derived constructor.
- [`no-throw-literal`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-throw-literal.ts): rejects throwing literals.
- [`no-undef-init`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-undef-init.ts): rejects initializing to `undefined`.
- [`no-undefined`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-undefined.ts): rejects the global `undefined` identifier.
- [`no-unneeded-ternary`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unneeded-ternary.ts): rejects redundant ternary expressions.
- [`no-unreachable`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unreachable.ts): reject statements that follow an unconditional `return`, `throw`, `break`, or `continue` in the same block, control flow has already left the block, so any later statement is dead code.
- [`no-unsafe-finally`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unsafe-finally.ts): rejects control flow from `finally`.
- [`no-unsafe-negation`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unsafe-negation.ts): rejects unsafe negation before relational checks.
- [`no-unsafe-optional-chaining`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unsafe-optional-chaining.ts): reject member access or call expressions that chain off an optional chain without continuing the chain.
- [`no-unused-expressions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unused-expressions.ts): rejects expression statements with no effect under ESLint's default semantics, accepting directive prologues (arbitrary text, determined by AST position) and productive expressions such as `void promise()` while rejecting tagged templates and misplaced strings; the upstream options are supported.
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
- [`prefer-arrow-callback`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-arrow-callback.ts): reject `function() { ... }` expressions passed as callback arguments. Prefer the arrow form.
- [`prefer-const`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-const.ts): prefers `const` for lexical `let` bindings that are never reassigned, including declaration-only and destructured bindings with ESLint-compatible options.
- [`prefer-destructuring`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-destructuring.ts): reject single-property and single-index variable declarations (`const a = obj.a`, `const x = arr[0]`) that destructuring would replace verbatim.
- [`prefer-exponentiation-operator`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-exponentiation-operator.ts): prefers `**` over `Math.pow`.
- [`prefer-for-of`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-for-of.ts): prefers `for...of` for simple array iteration.
- [`prefer-named-capture-group`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-named-capture-group.ts): reject regex literals with unnamed capturing groups `(...)`. Prefer named groups `(?<name>...)`.
- [`prefer-numeric-literals`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-numeric-literals.ts): prefer ES2015+ numeric literal forms (`0b…`, `0o…`, `0x…`) over `parseInt(string, 2 | 8 | 16)`.
- [`prefer-object-has-own`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-object-has-own.ts): prefer `Object.hasOwn(obj, key)` over `Object.prototype.hasOwnProperty.call(obj, key)`.
- [`prefer-object-spread`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-object-spread.ts): prefer object-spread `{ ...a, ...b }` over `Object.assign({}, a, b)`.
- [`prefer-rest-params`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-rest-params.ts): reject reading from `arguments` in a non-arrow function body. Prefer the ES2015 rest-parameter form `(...args)`.
- [`prefer-spread`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-spread.ts): prefers spread arguments over `.apply`.
- [`prefer-template`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-template.ts): prefers template literals over string concatenation.
- [`radix`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/radix.ts): requires a radix argument for `parseInt`.
- [`require-yield`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/require-yield.ts): requires generator functions to contain `yield`.
- [`sort-imports`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/sort-imports.ts): reject import specifiers within a single `import` declaration that aren't alphabetically sorted.
- [`sort-keys`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/sort-keys.ts): reject object-literal property keys that aren't alphabetically sorted.
- [`use-isnan`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/use-isnan.ts): requires `Number.isNaN`/`isNaN` for `NaN` checks.
- [`valid-typeof`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/valid-typeof.ts): restricts `typeof` comparisons to valid strings.
- [`vars-on-top`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/vars-on-top.ts): requires `var` declarations at the top of their scope.
- [`yoda`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/yoda.ts): rejects literal-first comparisons.

### TypeScript

TypeScript-only rules and `@typescript-eslint` plugin equivalents, exposed under the `typescript/*` namespace. Each rule either requires TypeScript syntax (interface, `enum`, `namespace`, `as`, `!`, `import type`, type parameters, declaration merging, parameter properties, triple-slash references) or originates from `@typescript-eslint` as a TS-aware extension that has no counterpart in plain ESLint.

Source: [`typescript-eslint`](https://github.com/typescript-eslint/typescript-eslint).

- [`typescript/adjacent-overload-signatures`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/adjacent-overload-signatures.ts): keeps overload declarations for the same member adjacent.
- [`typescript/array-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/array-type.ts): prefers `T[]` and `readonly T[]` over array helper types.
- [`typescript/await-thenable`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/await-thenable.ts): rejects `await` on a value that is neither a Promise nor a thenable, non-awaitable members passed to native Promise aggregators, `for await...of` over a value that is not async iterable, and `await using` of a resource that is not async disposable (type-aware).
- [`typescript/ban-ts-comment`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/ban-ts-comment.ts): rejects `@ts-ignore` and `@ts-nocheck`, and requires a description after `@ts-expect-error` (upstream recommended defaults; each directive configurable via `boolean`, `"allow-with-description"`, or `{ descriptionFormat }`).
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
- [`typescript/no-confusing-void-expression`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-confusing-void-expression.ts): reject `void X` expressions used in any position where the surrounding context expects a value, initializer, call argument, `return` operand, conditional, binary, or ternary subexpression.
- [`typescript/no-deprecated`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-deprecated.ts): reject references to declarations annotated `@deprecated` in their JSDoc, with the deprecation comment surfaced at the reference site (type-aware).
- [`typescript/no-duplicate-enum-values`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-duplicate-enum-values.ts): rejects duplicate enum member values.
- [`typescript/no-dynamic-delete`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-dynamic-delete.ts): rejects `delete` on dynamically computed property keys.
- [`typescript/no-empty-interface`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-interface.ts): rejects empty interfaces.
- [`typescript/no-empty-object-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-empty-object-type.ts): rejects empty object type literals.
- [`typescript/no-explicit-any`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-explicit-any.ts): rejects explicit `any`.
- [`typescript/no-extra-non-null-assertion`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-extra-non-null-assertion.ts): rejects repeated non-null assertions.
- [`typescript/no-extraneous-class`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-extraneous-class.ts): reject classes that exist purely as a namespace for static members or that are entirely empty.
- [`typescript/no-floating-promises`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-floating-promises.ts): rejects discarded built-in Promises, invalid rejection-handler chains, and Promise-bearing arrays; structural thenables, `void`, async IIFEs, and known-safe calls/types follow the rule's typed options.
- [`typescript/no-for-in-array`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-for-in-array.ts): reject `for (const k in arr)` where `arr` is statically typed as an array or tuple.
- [`typescript/no-import-type-side-effects`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-import-type-side-effects/violation.ts): hoists inline `type` modifiers into a single `import type` declaration.
- [`typescript/no-inferrable-types`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-inferrable-types.ts): rejects type annotations TypeScript can infer.
- [`typescript/no-invalid-void-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-invalid-void-type.ts): reject `void` used as anything other than a function return type.
- [`typescript/no-magic-numbers`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-magic-numbers.ts): typeScript-aware extension of `no-magic-numbers` that additionally ignores enum member values.
- [`typescript/no-meaningless-void-operator`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-meaningless-void-operator.ts): reject `void X` where `X` is already statically typed `void`, the operator adds nothing because the operand already evaluates to `undefined` (type-aware).
- [`typescript/no-misused-new`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-misused-new.ts): rejects constructor-like signatures in interfaces.
- [`typescript/no-misused-promises`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-misused-promises.ts): reject thenables in boolean, spread, synchronous-disposal, and void-return contexts using resolved types.
- [`typescript/no-misused-spread`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-misused-spread.ts): reject spread expressions whose operand is syntactically wrong for the surrounding context.
- [`typescript/no-mixed-enums`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-mixed-enums.ts): rejects enums that mix numeric and string members.
- [`typescript/no-namespace`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-namespace.ts): rejects non-ambient namespaces.
- [`typescript/no-non-null-asserted-nullish-coalescing`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-non-null-asserted-nullish-coalescing.ts): rejects non-null assertions next to `??`.
- [`typescript/no-non-null-asserted-optional-chain`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-non-null-asserted-optional-chain.ts): rejects non-null assertions on optional chains.
- [`typescript/no-non-null-assertion`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-non-null-assertion.ts): rejects postfix non-null assertions.
- [`typescript/no-redundant-type-constituents`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-redundant-type-constituents.ts): reject union and intersection type constituents that the type system absorbs anyway, `string | any` collapses to `any`, `T & never` collapses to `never`, `T & unknown` collapses to `T`, and repeated constituents add nothing.
- [`typescript/no-require-imports`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-require-imports.ts): rejects CommonJS `require` imports.
- [`typescript/no-restricted-types`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-restricted-types.ts): reject exact type spellings from the configured `types` map, with custom messages, automatic replacements, and editor suggestions; no options is a no-op.
- [`typescript/no-this-alias`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-this-alias.ts): rejects aliasing `this` to locals.
- [`typescript/no-unnecessary-boolean-literal-compare`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-unnecessary-boolean-literal-compare.ts): reject direct comparison of a boolean-typed value with `true` / `false` literals, `x === true` is just `x`, `x !== false` is just `x`.
- [`typescript/no-unnecessary-condition`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-unnecessary-condition.ts): reject conditions whose static type proves the runtime truthiness is fixed, `if ({})`, `if (null)`, `while ("")`, `0 && f()` (type-aware).
- [`typescript/no-unnecessary-parameter-property-assignment`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unnecessary-parameter-property-assignment.ts): rejects constructor assignments already handled by parameter properties.
- [`typescript/no-unnecessary-qualifier`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-unnecessary-qualifier.ts): reject namespace/enum qualifiers that the surrounding scope makes unnecessary (type-aware).
- [`typescript/no-unnecessary-template-expression`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-unnecessary-template-expression.ts): reject template literals that collapse to a regular string, `` `${"abc"}` ``, `` `${name}` `` around a string-typed value, or a plain `` `abc` `` with no escaped backticks (type-aware).
- [`typescript/no-unnecessary-type-arguments`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-unnecessary-type-arguments.ts): reject `Foo<DefaultT>` calls where the supplied generic argument is the same as the parameter's default, the argument adds nothing (type-aware).
- [`typescript/no-unnecessary-type-assertion`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-unnecessary-type-assertion.ts): reject `x as T`, `<T>x`, and `x!` assertions whose target type is the same as `x`'s already-known static type, the assertion adds nothing (type-aware).
- [`typescript/no-unnecessary-type-constraint`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unnecessary-type-constraint.ts): rejects redundant `extends any` and `extends unknown` constraints; its fix preserves the `<T,>` disambiguation required by single-parameter generic arrows in TSX, MTS, and CTS files.
- [`typescript/no-unsafe-argument`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-unsafe-argument.ts): reject passing an `any`-typed value to a parameter whose declared type is concrete (type-aware).
- [`typescript/no-unsafe-assignment`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-unsafe-assignment.ts): reject direct and recursively nested `any` values escaping through annotated or inferred variables, reassignments, defaults, class members, contextual properties, spreads, and destructuring; `unknown` receivers remain allowed (type-aware, no options).
- [`typescript/no-unsafe-call`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-unsafe-call.ts): reject calling a value whose static type is `any` (type-aware).
- [`typescript/no-unsafe-declaration-merging`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unsafe-declaration-merging.ts): rejects unsafe class/interface declaration merging.
- [`typescript/no-unsafe-enum-comparison`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-unsafe-enum-comparison.ts): reject `==` / `===` / `!=` / `!==` comparisons between an enum-typed value and a plain `number` or `string` of the same widened primitive, the comparison silently accepts unrelated enums and raw literals that happen to share the underlying primitive (type-aware).
- [`typescript/no-unsafe-function-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-unsafe-function-type.ts): rejects the unsafe `Function` type.
- [`typescript/no-unsafe-member-access`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-unsafe-member-access.ts): reject member access on a value whose static type is `any` (type-aware).
- [`typescript/no-unsafe-return`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-unsafe-return.ts): reject a `return` expression whose static type is `any` from a function whose declared return type is a concrete (non-`any` / non-`unknown` / non-`void`) shape, the `any` leaks past the type boundary and disables every downstream check on the returned value (type-aware).
- [`typescript/no-unsafe-unary-minus`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-unsafe-unary-minus.ts): reject the unary `-` operator applied to an operand whose static type is not number-like or bigint-like, `-x` silently coerces strings, objects, and other shapes via `Number(x)` and almost always indicates a bug (type-aware).
- [`typescript/no-useless-constructor`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-no-useless-constructor.ts): typeScript-aware extension of `no-useless-constructor` that tolerates a constructor existing solely to expose parameter properties.
- [`typescript/no-useless-empty-export`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-useless-empty-export.ts): rejects redundant empty `export {}` declarations in module files.
- [`typescript/no-wrapper-object-types`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/no-wrapper-object-types.ts): rejects boxed object type names such as `String` and `Boolean`.
- [`typescript/non-nullable-type-assertion-style`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/non-nullable-type-assertion-style.ts): reject `x as Foo` assertions whose target type is the non-nullable version of `x`'s static type. Replace with the shorter `x!` non-null assertion.
- [`typescript/only-throw-error`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/only-throw-error.ts): reject `throw X` where `X` is statically known not to derive from `Error`, string literals, numbers, plain object literals, and the like.
- [`typescript/parameter-properties`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-parameter-properties.ts): reject TypeScript parameter-property constructors (`constructor(public foo: T)`). Prefer plain field declarations so the class shape is visible from the member list instead of buried inside the constructor parameter list.
- [`typescript/prefer-as-const`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-as-const.ts): prefers `as const` over literal type assertions and matching literal type annotations on variables and class properties.
- [`typescript/prefer-enum-initializers`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-enum-initializers.ts): requires explicit enum member initializers.
- [`typescript/prefer-find`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-prefer-find.ts): prefer `array.find(predicate)` over `array.filter(predicate)[0]` / `.shift()` when only the first match is needed.
- [`typescript/prefer-function-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-function-type.ts): prefers function type aliases over single-call interfaces.
- [`typescript/prefer-includes`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-prefer-includes.ts): prefer `array.includes(x)` over `array.indexOf(x) !== -1` (and the matching `=== -1`, `>= 0`, `< 0`, `> -1` shapes) on array, tuple, and string receivers (type-aware).
- [`typescript/prefer-literal-enum-member`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-literal-enum-member.ts): prefers literal enum member initializers over computed expressions.
- [`typescript/prefer-namespace-keyword`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/prefer-namespace-keyword.ts): prefers `namespace` over TypeScript's legacy `module` keyword.
- [`typescript/prefer-nullish-coalescing`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-prefer-nullish-coalescing.ts): prefer `??` over `||` (and `??=` over `||=`, and `??` over the ternary `x ? x : y`) when the intent is to default `null` / `undefined`.
- [`typescript/prefer-optional-chain`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-prefer-optional-chain.ts): prefer an optional chain (`a?.b?.c`) over chained boolean guards such as `a && a.b && a.b.c` or `a != null && a.b`.
- [`typescript/prefer-promise-reject-errors`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-prefer-promise-reject-errors.ts): reject `Promise.reject(value)` where `value` is statically known not to derive from `Error`, type-aware analog of `only-throw-error` for the rejection side of the promise contract.
- [`typescript/prefer-readonly`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-prefer-readonly.ts): reject private class fields that could carry `readonly`.
- [`typescript/prefer-reduce-type-parameter`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-prefer-reduce-type-parameter.ts): prefer `arr.reduce<T>(..., initial)` over `arr.reduce(..., initial as T)` so the accumulator type is set on the call site instead of widened away inside the assertion (type-aware).
- [`typescript/prefer-regexp-exec`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-prefer-regexp-exec.ts): prefer `regex.exec(str)` over `str.match(regex)` when the regex carries the `g` flag, `.match` returns only the matched substrings and discards capture groups.
- [`typescript/prefer-return-this-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-prefer-return-this-type.ts): prefer the explicit `this` return type for chainable methods so fluent subclasses preserve their concrete `this` instead of widening to the base.
- [`typescript/prefer-string-starts-ends-with`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-prefer-string-starts-ends-with.ts): prefer `str.startsWith(p)` / `str.endsWith(p)` over `str.indexOf(p) === 0`, `str.indexOf(p, str.length - p.length) !== -1`, `str.lastIndexOf(p) === str.length - p.length`, and the anchored-regex `/^p/.test(str)` / `/p$/.test(str)` idioms (type-aware).
- [`typescript/promise-function-async`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-promise-function-async.ts): require functions whose return type is `Promise<T>` to be declared with the `async` keyword so synchronous throws surface as a rejected Promise (type-aware).
- [`typescript/related-getter-setter-pairs`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-related-getter-setter-pairs.ts): reject a `get` accessor whose declared return type does not match the parameter type of its companion `set` accessor on the same class, readers should not observe a type the writer cannot accept (type-aware).
- [`typescript/require-array-sort-compare`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-require-array-sort-compare.ts): require `arr.sort()` and `arr.toSorted()` calls to pass an explicit `compareFunction`.
- [`typescript/require-await`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/require-await.ts): reject `async` functions whose body contains no `await` expression.
- [`typescript/restrict-plus-operands`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-restrict-plus-operands.ts): rejects `+` expressions whose operands are not both `number`, both `string`, or both `bigint` (type-aware).
- [`typescript/restrict-template-expressions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-restrict-template-expressions.ts): reject template-literal interpolations whose expression carries a type that does not stringify cleanly, `${obj}` prints `"[object Object]"`, `${null}` prints `"null"`, and so on.
- [`typescript/return-await`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/return-await.ts): reject `return promise` inside `try`, `catch`, or `finally`; require `return await promise`.
- [`typescript/sort-type-constituents`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-sort-type-constituents.ts): sort the members of union (`A | B | C`) and intersection (`A & B & C`) types into a canonical order so reorderings don't show up as diffs.
- [`typescript/strict-boolean-expressions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-strict-boolean-expressions.ts): rejects non-boolean values used in a boolean context such as `if`, `&&`, `||`, or `!` (type-aware).
- [`typescript/switch-exhaustiveness-check`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-switch-exhaustiveness-check.ts): requires every enumerable discriminant member to have an explicit `case` by default; typed options control real/comment defaults and open types (type-aware).
- [`typescript/triple-slash-reference`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/triple-slash-reference/violation.ts): rejects triple-slash reference directives.
- [`typescript/unbound-method`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/typescript-unbound-method.ts): reject referencing a class instance method as a value instead of calling it (`obj.method` passed as a callback, aliased to a variable, or stored on another object).
- [`typescript/use-unknown-in-catch-callback-variable`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/use-unknown-in-catch-callback-variable.ts): require the callback parameter of `.catch(...)` and the second argument of `.then(...)` to be typed `unknown`.

### React

React TSX rules, Hooks correctness, JSX safety, the React Compiler subset, and Fast Refresh export shape. Bundles rules from three upstream plugins under one `react/*` namespace, matching Oxlint's layout. Performance-only rules live in [React performance](#react-performance) because they are opt-in toggles rather than correctness checks.

Source: [`eslint-plugin-react`](https://github.com/jsx-eslint/eslint-plugin-react), [`eslint-plugin-react-hooks`](https://github.com/facebook/react/tree/main/packages/eslint-plugin-react-hooks), [`eslint-plugin-react-refresh`](https://github.com/ArnaudBarre/eslint-plugin-react-refresh).

- [`react/button-has-type`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-button-has-type.tsx): requires explicit valid `type` values on JSX `button` elements.
- [`react/component-hook-factories`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-component-hook-factories.tsx): rejects nested component or Hook factories that call Hooks.
- [`react/display-name`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-display-name.tsx): require components wrapped in `React.memo(...)` or `React.forwardRef(...)` to be named, either by passing a named function, assigning the call to a named binding, or setting an explicit `displayName`.
- [`react/exhaustive-deps`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-exhaustive-deps.tsx): reports high-confidence missing identifier dependencies in `useEffect`, `useLayoutEffect`, `useInsertionEffect`, `useMemo`, and `useCallback`.
- [`react/iframe-missing-sandbox`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-iframe-missing-sandbox.tsx): requires JSX `iframe` elements to include a sandbox attribute.
- [`react/immutability`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-immutability.tsx): rejects local prop mutation inside components and Hooks.
- [`react/jsx-key`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-jsx-key.tsx): requires `key` props for JSX elements produced by arrays or `.map()`.
- [`react/jsx-no-duplicate-props`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-jsx-no-duplicate-props.tsx): rejects duplicate JSX prop names on the same element.
- [`react/jsx-no-script-url`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-jsx-no-script-url.tsx): rejects `javascript:` URLs in JSX URL-like props.
- [`react/jsx-no-target-blank`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-jsx-no-target-blank.tsx): reject `<a target="_blank">` (or any JSX element with `target="_blank"`) that does not also carry `rel="noreferrer"` (or `rel="noopener noreferrer"`).
- [`react/jsx-no-undef`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-jsx-no-undef.tsx): reject JSX elements whose tag is an uppercase identifier with no value-level declaration anywhere in the source file.
- [`react/jsx-no-useless-fragment`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-jsx-no-useless-fragment.tsx): reject JSX fragments that wrap exactly one element child or have no meaningful content. The child (or nothing) can be returned directly.
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

Detects freshly-allocated reference values (arrays, objects, functions, JSX elements) passed as JSX props. A new reference invalidates `React.memo` / `useMemo` shallow checks on every render. Useful for performance-critical render paths; usually unnecessary for top-level pages. Diagnostics only fire on `.tsx` source files, JSX heuristics rely on the file extension, so `.ts` files are skipped even when they contain JSX-like syntax.

Source: [`eslint-plugin-react-perf`](https://github.com/cvazac/eslint-plugin-react-perf).

- [`react-perf/jsx-no-jsx-as-prop`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-perf-jsx-no-jsx-as-prop.tsx): rejects freshly-created JSX elements or fragments passed as JSX props.
- [`react-perf/jsx-no-new-array-as-prop`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-perf-jsx-no-new-array-as-prop.tsx): rejects freshly-created arrays passed as JSX props.
- [`react-perf/jsx-no-new-function-as-prop`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-perf-jsx-no-new-function-as-prop.tsx): rejects freshly-created functions passed as JSX props.
- [`react-perf/jsx-no-new-object-as-prop`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/react-perf-jsx-no-new-object-as-prop.tsx): rejects freshly-created objects passed as JSX props.

### JSX accessibility

JSX accessibility rules applied to TSX (and JSX-in-TS) sources. Checks the static structure of JSX elements against WAI-ARIA authoring guidance, interactive controls should be focusable, labels should reference a control, ARIA properties should match the element role, and so on. Runtime accessibility issues require live audits; this family catches the statically-decidable subset. Component alias settings, router-specific anchor settings, and autofixes are deferred.

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
- [`jsx-a11y/img-redundant-alt`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/jsx-a11y-img-redundant-alt.tsx): rejects redundant words such as _image_, _photo_, or _picture_ inside the `alt` attribute of an `<img>`.
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

Next.js framework rules applied to TypeScript and TSX sources inside Next.js apps. Cover static TS/TSX Next.js source patterns the framework's runtime treats as load-bearing, pages/app routing, `<Head>` placement, font and script loading, image and link components, and common data export typos. Rules that need non-TypeScript files or runtime filesystem route discovery are intentionally conservative.

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
- [`solid/validate-jsx-nesting`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/solid-validate-jsx-nesting.tsx): reject JSX nestings that the HTML parser would silently restructure at runtime, `<p>` cannot contain block-level children, `<a>` cannot contain another `<a>`, and `<button>` cannot contain other interactive elements.

### Jest

Jest test source rules. Apply to TypeScript test files that use the Jest runner (`describe`, `test`/`it`, `expect`, lifecycle hooks). Guard test-quality patterns the type system cannot detect, unended assertions, focused tests left behind, duplicate hook calls.

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

Vitest test source rules. Vitest reuses much of Jest's testing surface but ships its own runner and configuration. These rules mirror the ergonomic subset of `eslint-plugin-jest` adapted for Vitest semantics, focused or disabled tests, duplicate titles, missing or conditional assertions, standalone `expect` calls, done callbacks, invalid `expect` chains, invalid titles, returned test values, and `.length` assertions that should use `toHaveLength`.

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

Playwright end-to-end test rules applied to TypeScript test files driven by the `@playwright/test` runner. Guard Playwright-specific patterns, locator usage, web-first assertions, focused/slowed tests. That would otherwise compile and run silently.

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

Promise correctness and style rules. Check the chain shape of Promise-using code: every chain ends with `catch`, no callback inside a `then`, no nested `.then().then()`, and so on. AST-local only, type-aware Promise checks belong with `typescript/*` checker rules.

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

### Unicorn

Modernization and style rules spanning array iteration, string and regex idioms, Node.js APIs, error handling, module syntax, DOM APIs, and code shape. Rewrite legacy patterns into their modern counterparts (`for...of` over `forEach`, `Array#flatMap` over `map().flat()`, `String#replaceAll` over a global-regex `replace`, `Math.trunc` over `| 0`), forbid known anti-patterns (`null` literals, abusive `eslint-disable`, `new Buffer`, `process.exit`, `instanceof Array`), and pin a consistent style for things [ESLint core](#eslint-core) and [TypeScript](#typescript) leave underspecified (filename case, numeric separators, catch-binding names, expiring TODOs, escape-sequence case, switch-case braces). Most rules are pure AST checks; binding-aware rules use the TypeScript checker when lexical identity is part of the contract.

Source: [`eslint-plugin-unicorn`](https://github.com/sindresorhus/eslint-plugin-unicorn).

- [`unicorn/better-regex`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-better-regex.ts): rewrite regex literals into shorter, consistent, and safer form (character-class shorthands, redundant ranges).
- [`unicorn/catch-error-name`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-catch-error-name.ts): enforce a canonical parameter name (`error`) in `catch` clauses.
- [`unicorn/consistent-assert`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-consistent-assert.ts): enforce consistent assertion style when using `node:assert`.
- [`unicorn/consistent-date-clone`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-consistent-date-clone.ts): prefer passing a `Date` directly to the `Date` constructor when cloning, not `+date` or `date.getTime()`.
- [`unicorn/consistent-destructuring`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-consistent-destructuring.ts): once a property is destructured from an object, require subsequent reads to use the destructured binding.
- [`unicorn/consistent-empty-array-spread`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-consistent-empty-array-spread.ts): require both branches of a ternary spread inside an array literal to be array-typed.
- [`unicorn/consistent-existence-index-check`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-consistent-existence-index-check.ts): enforce a consistent comparison form (`< 0` vs `=== -1`, `>= 0` vs `!== -1`) for `indexOf` / `findIndex` existence checks.
- [`unicorn/consistent-function-scoping`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-consistent-function-scoping.ts): hoist function declarations, expressions, and (by default) arrows to the highest scope that does not capture an enclosing binding or lexical environment.
- [`unicorn/consistent-template-literal-escape`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-consistent-template-literal-escape.ts): enforce the `\${` spelling over `$\{` when escaping `${` in template literals.
- [`unicorn/custom-error-definition`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-custom-error-definition.ts): require user-defined `Error` subclasses to set `name`, call `super(message)`, and assign their stack correctly.
- [`unicorn/empty-brace-spaces`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-empty-brace-spaces.ts): reject whitespace inside empty `{}` braces.
- [`unicorn/error-message`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-error-message.ts): require a non-empty `message` argument when constructing a built-in `Error`.
- [`unicorn/escape-case`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-escape-case.ts): require consistent case for escape sequences (`\xA9` over `\xa9`, `\u00B5` over `\u00b5`).
- [`unicorn/expiring-todo-comments`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-expiring-todo-comments.ts): require every `TODO`/`FIXME`/`XXX` comment to declare an expiration date or package version.
- [`unicorn/explicit-length-check`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-explicit-length-check.ts): require explicit comparison of `.length` / `.size` instead of relying on truthy coercion.
- [`unicorn/filename-case`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-filename-case.ts): enforce a single case style (kebab/camel/snake/pascal) for source filenames and directory names.
- [`unicorn/import-style`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-import-style.ts): restrict each module's allowed import styles (named only, default only, namespace only); supports per-module `styles` maps, default-table extension, and per-syntax-family check toggles.
- [`unicorn/isolated-functions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-isolated-functions.ts): reject references to outer-scope variables inside functions marked as isolated (e.g., the body of a web worker).
- [`unicorn/new-for-builtins`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-new-for-builtins.ts): require `new` when calling builtin constructors like `Error`, `Map`, `Set`, `Date`, and forbid `new` on primitive wrappers like `String`, `Number`, `Boolean`.
- [`unicorn/no-abusive-eslint-disable`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-abusive-eslint-disable.ts): require every `eslint-disable*` directive to name the rules it disables.
- [`unicorn/no-accessor-recursion`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-accessor-recursion.ts): reject recursive reads on `this.<prop>` inside the getter / setter for `<prop>`.
- [`unicorn/no-anonymous-default-export`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-anonymous-default-export.ts): require a name on every default-exported function, class, or object.
- [`unicorn/no-array-callback-reference`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-array-callback-reference.ts): reject passing a function reference directly as the callback to `map`/`filter`/`forEach`/etc., which silently leaks extra index/array arguments.
- [`unicorn/no-array-for-each`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-array-for-each.ts): prefer `for...of` over `Array.prototype.forEach`.
- [`unicorn/no-array-method-this-argument`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-array-method-this-argument.ts): reject the second `thisArg` argument to array methods; use an explicit closure instead.
- [`unicorn/no-array-reduce`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-array-reduce.ts): reject `Array#reduce` / `Array#reduceRight` in favor of explicit loops or other helpers.
- [`unicorn/no-array-reverse`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-array-reverse.ts): prefer `Array#toReversed` over the mutating `Array#reverse`.
- [`unicorn/no-array-sort`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-array-sort.ts): prefer `Array#toSorted` over the mutating `Array#sort`.
- [`unicorn/no-await-expression-member`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-await-expression-member.ts): reject member access on an `await` expression without parens; require `(await x).y`.
- [`unicorn/no-await-in-promise-methods`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-await-in-promise-methods.ts): reject `await` inside arrays passed to `Promise.all`/`Promise.allSettled`/`Promise.race`/`Promise.any`. The awaits serialize the calls.
- [`unicorn/no-console-spaces`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-console-spaces.ts): reject leading or trailing spaces in arguments to `console.log` and friends, `console` already inserts spaces between arguments.
- [`unicorn/no-document-cookie`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-document-cookie.ts): reject direct reads or assignments to `document.cookie`; use the Cookie Store API or a wrapper.
- [`unicorn/no-empty-file`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-empty-file.ts): reject source files whose only content is whitespace and/or comments.
- [`unicorn/no-for-loop`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-for-loop.ts): prefer `for...of` over index-based `for` loops over arrays.
- [`unicorn/no-hex-escape`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-hex-escape.ts): prefer Unicode escape (`\u00A9`) over hexadecimal escape (`\xA9`).
- [`unicorn/no-immediate-mutation`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-immediate-mutation.ts): reject mutating a value on the same expression that produces it (`[...x].push(y)`); separate the construction and the mutation.
- [`unicorn/no-instanceof-builtins`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-instanceof-builtins.ts): reject `instanceof Array`, `instanceof Error`, `instanceof Map`, etc.. They fail across realms and for subclasses.
- [`unicorn/no-invalid-fetch-options`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-invalid-fetch-options.ts): reject GET / HEAD `fetch()` calls that also set a request `body`, which throws at runtime.
- [`unicorn/no-invalid-remove-event-listener`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-invalid-remove-event-listener.ts): reject `removeEventListener` calls whose handler argument is a fresh function reference and therefore matches no registered listener.
- [`unicorn/no-keyword-prefix`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-keyword-prefix.ts): reject identifiers that start with a reserved word (`newFoo`, `classBar`).
- [`unicorn/no-lonely-if`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-lonely-if.ts): reject `if` as the only statement inside an `else` block; use `else if` instead.
- [`unicorn/no-magic-array-flat-depth`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-magic-array-flat-depth.ts): reject magic-number depth arguments to `Array#flat`; require `Infinity` or a named constant.
- [`unicorn/no-named-default`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-named-default.ts): reject re-importing or re-exporting a default binding under a name that differs from the upstream binding.
- [`unicorn/no-negated-condition`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-negated-condition.ts): reject negated conditions in `if`/`else` and ternaries when the positive form is shorter.
- [`unicorn/no-negation-in-equality-check`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-negation-in-equality-check.ts): reject `!a === b`; require `a !== b` or `!(a === b)`.
- [`unicorn/no-nested-ternary`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-nested-ternary.ts): reject ternaries nested inside other ternaries.
- [`unicorn/no-new-array`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-new-array.ts): reject the `new Array(...)` constructor; use array literals or `Array.from` / `Array.of`.
- [`unicorn/no-new-buffer`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-new-buffer.ts): reject the deprecated `new Buffer()` constructor; use `Buffer.from` or `Buffer.alloc`.
- [`unicorn/no-null`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-null.ts): reject the `null` literal in favor of `undefined`.
- [`unicorn/no-object-as-default-parameter`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-object-as-default-parameter.ts): reject inline object literals as default values for function parameters.
- [`unicorn/no-process-exit`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-process-exit.ts): reject `process.exit()`; throw or return a non-zero status instead.
- [`unicorn/no-single-promise-in-promise-methods`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-single-promise-in-promise-methods.ts): reject `Promise.all`/`Promise.race`/etc. called with a single-element array; the wrapper is redundant.
- [`unicorn/no-static-only-class`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-static-only-class.ts): reject classes whose every member is `static`; use a plain module-level namespace instead.
- [`unicorn/no-thenable`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-thenable.ts): reject defining a property named `then` on objects, modules, or classes, `await` and Promise resolution accidentally invoke it.
- [`unicorn/no-this-assignment`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-this-assignment.ts): reject `const self = this` and similar aliases; capture via arrow functions instead.
- [`unicorn/no-typeof-undefined`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-typeof-undefined.ts): reject `typeof x === "undefined"`; compare against `undefined` directly.
- [`unicorn/no-unnecessary-array-flat-depth`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-unnecessary-array-flat-depth.ts): reject `1` as the explicit depth argument of `Array#flat`; the default is already `1`.
- [`unicorn/no-unnecessary-array-splice-count`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-unnecessary-array-splice-count.ts): reject `.length` / `Infinity` as the deleteCount argument to `splice` / `toSpliced`; omit it to delete to the end.
- [`unicorn/no-unnecessary-await`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-unnecessary-await.ts): reject `await` on non-thenable expressions.
- [`unicorn/no-unnecessary-polyfills`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-unnecessary-polyfills.ts): reject polyfill imports for APIs already available in the project's targeted Node/browser baseline.
- [`unicorn/no-unnecessary-slice-end`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-unnecessary-slice-end.ts): reject `.length` / `Infinity` as the end argument to `slice`; omit it to slice to the end.
- [`unicorn/no-unreadable-array-destructuring`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-unreadable-array-destructuring.ts): reject destructuring patterns with long hole runs (`[,,,,a]`); use a named index instead.
- [`unicorn/no-unreadable-iife`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-unreadable-iife.ts): reject IIFEs whose nesting (multiple parens, arrow IIFE arguments) is hard to read.
- [`unicorn/no-unused-properties`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-unused-properties.ts): reject object properties that are never read after definition.
- [`unicorn/no-useless-collection-argument`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-useless-collection-argument.ts): reject useless initializer arguments (`new Set()`, `new Map([])`, `new Set(undefined)`) on collection constructors.
- [`unicorn/no-useless-error-capture-stack-trace`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-useless-error-capture-stack-trace.ts): reject `Error.captureStackTrace(this, constructor)` when the surrounding subclass relies on the default `Error` capture.
- [`unicorn/no-useless-fallback-in-spread`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-useless-fallback-in-spread.ts): reject `...(x ?? {})` and similar fallbacks when spreading; the spread of `null`/`undefined` is already a no-op.
- [`unicorn/no-useless-iterator-to-array`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-useless-iterator-to-array.ts): reject `[...iterator]` / `Array.from(iterator)` when the iterator can be consumed directly (e.g., inside `for...of`).
- [`unicorn/no-useless-length-check`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-useless-length-check.ts): reject `arr.length` checks that the iteration method itself already handles.
- [`unicorn/no-useless-promise-resolve-reject`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-useless-promise-resolve-reject.ts): reject `return Promise.resolve(x)` / `return Promise.reject(e)` inside `async` functions, `return x` and `throw e` work identically.
- [`unicorn/no-useless-spread`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-useless-spread.ts): reject spreading a single iterable into a new collection of the same kind (`[...arr]`, `{...obj}`) when the original would suffice.
- [`unicorn/no-useless-switch-case`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-useless-switch-case.ts): reject `case` clauses with an empty body that immediately precede a `default` whose body executes for them.
- [`unicorn/no-useless-undefined`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-useless-undefined.ts): reject explicit `undefined` returns, default initializers, and arguments where the omission has the same meaning.
- [`unicorn/no-zero-fractions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-no-zero-fractions.ts): reject `1.0` / `1.` / `.5e0` in favor of `1`, `1`, and `0.5`.
- [`unicorn/number-literal-case`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-number-literal-case.ts): enforce one consistent case for the prefix and digits of hex/binary/octal literals (`0xFF` over `0xff`).
- [`unicorn/numeric-separators-style`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-numeric-separators-style.ts): enforce `_` separator grouping (every 3 digits for decimal, every 4 for hex) in numeric literals.
- [`unicorn/prefer-add-event-listener`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-add-event-listener.ts): prefer `addEventListener` / `removeEventListener` over assigning to `on*` properties.
- [`unicorn/prefer-array-find`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-array-find.ts): prefer `Array#find` / `Array#findLast` over `filter(...)[0]` / `filter(...).at(-1)`.
- [`unicorn/prefer-array-flat`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-array-flat.ts): prefer `Array#flat` over legacy flattening idioms (`[].concat(...arrs)`, `reduce` with `concat`).
- [`unicorn/prefer-array-flat-map`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-array-flat-map.ts): prefer `Array#flatMap` over `map(...).flat()`.
- [`unicorn/prefer-array-index-of`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-array-index-of.ts): prefer `indexOf` / `lastIndexOf` over `findIndex` / `findLastIndex` when matching by `===`.
- [`unicorn/prefer-array-some`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-array-some.ts): prefer `Array#some` over `filter(...).length > 0`, `find(...) !== undefined`, and similar shapes.
- [`unicorn/prefer-at`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-at.ts): prefer `Array#at` / `String#at` over index arithmetic and `charAt`.
- [`unicorn/prefer-bigint-literals`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-bigint-literals.ts): prefer `1n` over `BigInt(1)` and `BigInt("1")`.
- [`unicorn/prefer-blob-reading-methods`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-blob-reading-methods.ts): prefer `Blob#arrayBuffer()` / `Blob#text()` over `FileReader#readAsArrayBuffer` / `readAsText`.
- [`unicorn/prefer-class-fields`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-class-fields.ts): prefer class field declarations over constructor assignments to `this.field = value`.
- [`unicorn/prefer-classlist-toggle`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-classlist-toggle.ts): prefer `Element#classList.toggle(name, condition)` over manual `add`/`remove` branches.
- [`unicorn/prefer-code-point`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-code-point.ts): prefer `String#codePointAt` / `String.fromCodePoint` over `charCodeAt` / `fromCharCode`.
- [`unicorn/prefer-date-now`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-date-now.ts): prefer `Date.now()` over `new Date().getTime()` / `+new Date()`.
- [`unicorn/prefer-default-parameters`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-default-parameters.ts): prefer default parameter syntax over `x = x ?? default` reassignments inside the function body.
- [`unicorn/prefer-dom-node-append`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-dom-node-append.ts): prefer `Node#append` over `Node#appendChild`.
- [`unicorn/prefer-dom-node-dataset`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-dom-node-dataset.ts): prefer `Element#dataset` over `getAttribute` / `setAttribute` for `data-*` attributes.
- [`unicorn/prefer-dom-node-remove`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-dom-node-remove.ts): prefer `ChildNode#remove` over `parent.removeChild(child)`.
- [`unicorn/prefer-dom-node-text-content`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-dom-node-text-content.ts): prefer `Node#textContent` over `HTMLElement#innerText`.
- [`unicorn/prefer-event-target`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-event-target.ts): prefer `EventTarget` over Node's `EventEmitter` when the code is shared between Node and the browser.
- [`unicorn/prefer-export-from`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-export-from.ts): prefer `export ... from` over importing-then-re-exporting in two statements.
- [`unicorn/prefer-global-this`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-global-this.ts): prefer `globalThis` over `window`, `self`, and `global`.
- [`unicorn/prefer-import-meta-properties`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-import-meta-properties.ts): prefer `import.meta.dirname` / `import.meta.filename` over `fileURLToPath` workarounds.
- [`unicorn/prefer-includes`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-includes.ts): prefer `String#includes` / `Array#includes` over `indexOf(...) !== -1` and `some(x => x === target)`.
- [`unicorn/prefer-json-parse-buffer`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-json-parse-buffer.ts): prefer passing a `Buffer` directly to `JSON.parse` (Node 21+) instead of decoding to a string first.
- [`unicorn/prefer-keyboard-event-key`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-keyboard-event-key.ts): prefer `KeyboardEvent#key` over the deprecated `KeyboardEvent#keyCode` / `charCode` / `which`.
- [`unicorn/prefer-logical-operator-over-ternary`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-logical-operator-over-ternary.ts): prefer `a || b` / `a ?? b` over the equivalent ternary `a ? a : b`.
- [`unicorn/prefer-math-min-max`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-math-min-max.ts): prefer `Math.min` / `Math.max` over ternaries computing the same value.
- [`unicorn/prefer-math-trunc`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-math-trunc.ts): prefer `Math.trunc` over `~~x` / `x | 0` for integer truncation.
- [`unicorn/prefer-modern-dom-apis`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-modern-dom-apis.ts): prefer `before` / `after` / `replaceWith` over `insertBefore` / `replaceChild` / `insertAdjacentText`.
- [`unicorn/prefer-modern-math-apis`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-modern-math-apis.ts): prefer `Math.log10` / `Math.hypot` / `Math.log2` / `Math.cbrt` over their legacy approximations.
- [`unicorn/prefer-module`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-module.ts): prefer ES modules (`import` / `export`) over CommonJS (`require` / `module.exports` / `__dirname` / `__filename`).
- [`unicorn/prefer-native-coercion-functions`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-native-coercion-functions.ts): prefer the bare `String` / `Number` / `Boolean` / `BigInt` functions over `x => String(x)` arrow wrappers.
- [`unicorn/prefer-negative-index`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-negative-index.ts): prefer negative-index lookups (`arr.at(-1)`, `arr.slice(-2)`) over `arr.length - 1` / `arr.length - 2` arithmetic.
- [`unicorn/prefer-node-protocol`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-node-protocol.ts): prefer `node:fs` / `node:path` / etc. over the bare Node builtin specifier.
- [`unicorn/prefer-number-properties`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-number-properties.ts): prefer `Number.isNaN` / `Number.parseInt` / `Number.NaN` over their global counterparts.
- [`unicorn/prefer-object-from-entries`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-object-from-entries.ts): prefer `Object.fromEntries` over `reduce`-into-object patterns.
- [`unicorn/prefer-optional-catch-binding`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-optional-catch-binding.ts): prefer `catch { ... }` over `catch (e) { ... }` when `e` is unused.
- [`unicorn/prefer-prototype-methods`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-prototype-methods.ts): prefer borrowing prototype methods (`Array.prototype.slice.call`) over `[].slice.call` empty-instance lookups.
- [`unicorn/prefer-query-selector`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-query-selector.ts): prefer `Document#querySelector` over `getElementById`, `getElementsByClassName`, and `getElementsByTagName`.
- [`unicorn/prefer-reflect-apply`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-reflect-apply.ts): prefer `Reflect.apply(fn, thisArg, args)` over `Function.prototype.apply.call(fn, thisArg, args)`.
- [`unicorn/prefer-regexp-test`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-regexp-test.ts): prefer `RegExp#test` over `String#match` / `RegExp#exec` when only a boolean is needed.
- [`unicorn/prefer-response-static-json`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-response-static-json.ts): prefer `Response.json(value)` over `new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } })`.
- [`unicorn/prefer-set-has`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-set-has.ts): prefer `Set#has` over `Array#includes` for repeated membership lookups against a constant collection.
- [`unicorn/prefer-set-size`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-set-size.ts): prefer `Set#size` over `[...set].length` and `Array.from(set).length`.
- [`unicorn/prefer-simple-condition-first`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-simple-condition-first.ts): place identifier and strict-comparison gates before complex conditions in boolean `&&`/`||` chains.
- [`unicorn/prefer-single-call`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-single-call.ts): prefer a single `push` / `unshift` / `classList.add` / `addEventListener` with multiple arguments over consecutive single-argument calls.
- [`unicorn/prefer-spread`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-spread.ts): prefer spread (`[...arr]`, `[...str]`) over `Array.from`, `Array.prototype.slice.call`, `concat([])`, and `split('')`.
- [`unicorn/prefer-string-raw`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-string-raw.ts): prefer `String.raw` for path literals and other strings that would otherwise need backslash escapes.
- [`unicorn/prefer-string-replace-all`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-string-replace-all.ts): prefer `String#replaceAll(literal, replacement)` over `replace(/literal/g, replacement)`.
- [`unicorn/prefer-string-slice`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-string-slice.ts): prefer `String#slice` over the deprecated `substr` / `substring`.
- [`unicorn/prefer-string-starts-ends-with`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-string-starts-ends-with.ts): prefer `String#startsWith` / `String#endsWith` over equivalent `RegExp#test` and slice-then-compare idioms.
- [`unicorn/prefer-string-trim-start-end`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-string-trim-start-end.ts): prefer `String#trimStart` / `String#trimEnd` over the deprecated `trimLeft` / `trimRight`.
- [`unicorn/prefer-structured-clone`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-structured-clone.ts): prefer `structuredClone(x)` over `JSON.parse(JSON.stringify(x))` for deep cloning.
- [`unicorn/prefer-switch`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-switch.ts): prefer `switch` over chains of three or more `else if` clauses comparing the same discriminant.
- [`unicorn/prefer-ternary`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-ternary.ts): prefer a ternary over `if` / `else` whose two branches differ only in the right-hand side of a common assignment, `return`, or `throw`.
- [`unicorn/prefer-top-level-await`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-top-level-await.ts): prefer top-level `await` over `.then` / IIFE wrappers in ES modules.
- [`unicorn/prefer-type-error`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prefer-type-error.ts): require throwing `TypeError` (not a bare `Error`) when the surrounding `if` is a runtime type check.
- [`unicorn/prevent-abbreviations`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-prevent-abbreviations.ts): apply the canonical word-replacement table to bindings, compound names, opt-in property checks, and filenames. This compatibility ID retains the final upstream behavior from before the rule was renamed to `name-replacements`.
- [`unicorn/relative-url-style`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-relative-url-style.ts): enforce a single style (always leading `./` vs. never) for relative URLs passed to `new URL`.
- [`unicorn/require-array-join-separator`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-require-array-join-separator.ts): require an explicit separator argument to `Array#join` instead of relying on the default `","`.
- [`unicorn/require-module-attributes`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-require-module-attributes.ts): require non-empty `with` / `assert` options on `import` / `export` statements that use them at all.
- [`unicorn/require-module-specifiers`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-require-module-specifiers.ts): require a non-empty specifier list on every `import` / `export` statement.
- [`unicorn/require-number-to-fixed-digits-argument`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-require-number-to-fixed-digits-argument.ts): require an explicit digits argument to `Number#toFixed`.
- [`unicorn/require-post-message-target-origin`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-require-post-message-target-origin.ts): require an explicit `targetOrigin` argument to `window.postMessage`.
- [`unicorn/string-content`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-string-content.ts): rewrite configured `patterns` inside string literals and template quasis (e.g., curly quotes for straight ones); no default patterns, per-pattern `suggest` / `fix` / `caseSensitive` / `message`, and AST-selector targeting.
- [`unicorn/switch-case-braces`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-switch-case-braces.ts): enforce a consistent presence/absence of `{}` braces around `case` clauses inside `switch`.
- [`unicorn/switch-case-break-position`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-switch-case-break-position.ts): require a terminating `break`, `continue`, `return`, or `throw` to sit inside a `case` clause's sole block instead of immediately after it.
- [`unicorn/template-indent`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-template-indent.ts): normalize selected multiline template bodies while preserving substitutions and raw escapes; supports tag, function, block-comment, AST-selector, and explicit indentation options.
- [`unicorn/text-encoding-identifier-case`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-text-encoding-identifier-case.ts): enforce a canonical case for text-encoding identifiers, `"utf-8"` (not `"UTF-8"` / `"utf8"`).
- [`unicorn/throw-new-error`](https://github.com/samchon/ttsc/blob/master/tests/test-lint/src/cases/unicorn-throw-new-error.ts): require `throw new Error(...)` over `throw Error(...)`.

### Regular expressions

Regex-shape rules. Check the structure of regex literals, emptiness, uselessness, flag ordering, shorthand classes, Unicode support. Some rules supersede the regex-related rules in [ESLint core](#eslint-core); both ids exist so projects can keep the legacy ESLint names alongside the regexp-plugin variants.

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

Security-focused TypeScript source rules. Report likely security smells, non-literal sinks for eval, file I/O, regex construction, child-process spawning, cryptographic primitives. That warrant human review even if no exploit is statically provable. Treat findings as _hints_, not proofs.

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

Documentation-comment validation rules. Bundles `eslint-plugin-jsdoc` content checks (tag names, parameter coverage, descriptions) with the lone `eslint-plugin-tsdoc` syntax check (`jsdoc/tsdoc-syntax`). Both target `/** ... */` comments. Formatting concerns (alignment, indentation) are configured through the top-level [`format`](#format) block, not here.

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

Functional-programming policy rules. Push code toward immutability, side-effect-free expressions, and expression-style control flow. Most rules are useful in pieces, projects rarely enable the whole family at `"error"`. Enabling the whole set together expresses a strict functional-core / imperative-shell discipline. Diagnostic-only: `ttsc fix` does not rewrite mutation, classes, exceptions, loops, or branching into a functional design.

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

Architecture-boundary rules enforce import direction and module visibility between configured source-path _elements_ (layers, features, apps in a monorepo). Every rule operates on the _resolved source file_ of an import, relative imports are followed to the real `.ts`/`.tsx`/`.d.ts` file before classification. Boundary diagnostics do not offer autofixes, a violation usually needs an API or architecture decision, not a mechanical import rewrite.

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

Contributor rules emit autofixes the same way built-ins do, call `ctx.ReportFix(node, message, edits...)` or `ctx.ReportRangeFix(pos, end, message, edits...)`. The `rule/astutil` package re-exports the byte-range helpers built-ins use (`NodeText`, `KeywordStart`, `FindKeyword`, `TokenRange`). See the [contributor autofix path](https://ttsc.dev/docs/development/walkthroughs/lint#the-contributor-autofix-path) section for the full contract and an example.

Contributor rules run on declaration files (`.d.ts`) by default. The engine skips its own value-level rules there — executable grammar cannot appear in a declaration file — but it cannot infer a third-party rule's shape, so contributors keep the conservative default. A rule that only inspects executable code can implement the optional `rule.DeclarationFileRule` marker (`VisitsDeclarationFiles() bool { return false }`) to get the same skip and save the dispatch on declaration-heavy projects.

### Project-scoped contributor rules

Contributors that validate the loaded Program rather than individual AST nodes can register a public `rule.ProjectRule`:

```go
type noCycles struct{}

func (noCycles) Name() string { return "architecture/no-cycles" }
func (noCycles) Check(ctx *rule.ProjectContext) {
  // ctx.Sources is the tsconfig-selected user-source set, including an empty set.
  // ctx.Checker is the Program checker, and ctx.Identity keeps logical and
  // physical project paths separate.
  if cycle := findCycle(ctx.Sources, ctx.Checker); cycle != "" {
    ctx.Report(cycle)
  }
}

func init() { rule.RegisterProject(noCycles{}) }
```

Each project rule runs once per loaded Program, before file rules. `ctx.Identity` includes the invocation cwd, logical and physical config paths and roots, an optional explicit project root, the plugin-config origin, and a lifecycle id. `Report` marks the rule failed and emits one project finding; `Fail` marks it failed without a finding. Later file rules can call `ctx.ProjectResult(name)` and distinguish `absent`, `off`, `not_evaluated`, `passed`, and `failed`.

Project rules use the normal `rules` map and `extends` order, but only global config entries may configure them. Any entry that contains `files`, including `files: []` or an `off` value, is rejected. Global `ignores` remain source-file filters rather than project-rule selectors. A later bare severity preserves the last explicit tuple options while replacing severity.

CLI, API, watch, and LSP runs carry the same project identity into the native host. Structured API findings use `file: null`. LSP publishes project findings once at the logical config URI with a zero range and no document version; project findings never provide fixes or code actions.

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `ttsc` development.

## References

<!--
AGENT INSTRUCTIONS, adding a new upstream reference.

When you add a new rule family to [Rules](#rules), do all of:

1. Append one bullet to the list immediately below. Shape:
       - [\`<upstream-package>\`](https://github.com/<org>/<repo>)
   Use the npm package name in backticks. Drop the leading `eslint-plugin-` only
   when the rule family namespace itself drops it (e.g. `@next/eslint-plugin-next`,
   `@vitest/eslint-plugin`).
2. If the family namespace inside `@ttsc/lint` (`react/*`, `jest/*`, …) is a port of
   that single upstream, mention the namespace in `### Claim ownership` so the
   maintainers know the port belongs to their family. The paragraph already lists
   `react/*, jest/*, playwright/*, tanstack-query/*, promise/*, and the other family
   namespaces`, extend that list naturally; do not start a new sentence per family.
3. Do NOT put license parentheticals (`(MIT)`, `(BSD-3-Clause)`, etc.) after the
   link. Reader clicks through if they need the license.
4. Order is roughly the same as the family ordering in [Rules](#rules); insert at
   the matching position rather than appending blindly at the end.
-->

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

To the maintainers of every plugin listed above: the rule semantics under `react/*`, `jest/*`, `playwright/*`, `tanstack-query/*`, `promise/*`, and the other family namespaces inside `@ttsc/lint` are a Go re-implementation of your work for the TypeScript-Go Checker. The intent is convenience, projects on `ttsc` get your rules without standing up a separate ESLint process, not ownership.

If you would prefer to publish a first-party `@ttsc/lint` plugin for your family yourself, you are welcome to take the Go sources under [`packages/lint/linthost/rules_*.go`](https://github.com/samchon/ttsc/tree/master/packages/lint/linthost) and the fixtures under [`tests/test-lint/src/cases/`](https://github.com/samchon/ttsc/tree/master/tests/test-lint/src/cases) and ship them as your own contributor plugin. Open an issue at [samchon/ttsc](https://github.com/samchon/ttsc/issues) when the upstream package is ready, and I will retire the in-tree port and add a redirect line under [Rules](#rules) pointing at your package. Same offer for partial coverage. Name a subset and I will remove just those rules.

The contributor-plugin walkthrough is the [`@ttsc/lint` development guide](https://ttsc.dev/docs/development/walkthroughs/lint).
