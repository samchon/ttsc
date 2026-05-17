# `@ttsc/lint`

![banner of @ttsc/lint](https://raw.githubusercontent.com/samchon/ttsc/refs/heads/master/assets/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE)
[![NPM Version](https://img.shields.io/npm/v/@ttsc/lint.svg)](https://www.npmjs.com/package/@ttsc/lint)
[![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/lint.svg)](https://www.npmjs.com/package/@ttsc/lint)
[![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest)
[![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs)
[![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

A linter and formatter. Co-protagonist of the [`ttsc`](https://ttsc.dev) toolchain.

Paired with `ttsc`, `@ttsc/lint` replaces `eslint` and `prettier`. 140+ lint rules plus a built-in formatter. Lint violations come out of the compile pass as `error TSxxxxx` — the CI step that already blocks on `tsc` blocks on lint too. The formatter writes back via `ttsc format` (warning severity by default; promote any rule to `"error"` if you want format diffs to fail the build too).

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

Register the plugin in `tsconfig.json` and drop a `lint.config.ts` next to it:

```jsonc
// tsconfig.json
{ "compilerOptions": { "plugins": [{ "transform": "@ttsc/lint" }] } }
```

```ts
// lint.config.ts
import type { TtscLintConfig } from "@ttsc/lint";

export default {
  rules: {
    "no-var": "error",
    "prefer-const": "error",
    "no-explicit-any": "warning",
    "no-console": "off",
  },
  format: {
    printWidth: 100,
    singleQuote: true,
    trailingComma: "all",
  },
} satisfies TtscLintConfig;
```

Two top-level keys, on purpose:

- `rules` sets severity for each lint rule. `"error"` fails the build; `"warning"` prints; `"off"` disables.
- `format` is a Prettier-style block (keys mirror `.prettierrc`) that drives the `format/*` autofixes. Defaults to `severity: "warning"` — applied via `ttsc format`, not gated in `ttsc check`. Promote individual format rules to `"error"` under `rules` if you want format diffs to fail the build.

Run your normal `ttsc` or `ttsx`:

```bash
npx ttsc
npx ttsx src/index.ts
```

Errors fail the command; warnings print without affecting the exit code.

For inline `compilerOptions.plugins[].rules`, `extends` paths, and `eslint.config.*` reuse, see the [Setup guide](https://ttsc.dev/docs/lint/setup).

## Fix and format

`ttsc fix` applies every autofix the enabled rules offer — lint and format together — writes results back to disk, then re-runs type-check + lint. `ttsc format` runs the `format/*` subset through the same dataflow.

```bash
npx ttsc fix
npx ttsc format
```

Full mechanics live in:

- [Fix guide](https://ttsc.dev/docs/lint/fix) — autofix order, re-check pass, ESLint interop.
- [Format guide](https://ttsc.dev/docs/lint/format) — the Prettier-style `printWidth` reflow and the field-by-field `.prettierrc` mapping.
- [Rules catalog](https://ttsc.dev/docs/lint/rules) — all 140+ rules and their options.

## Third-party rule plugins

Other npm packages can ship lint rules that compile into the same `@ttsc/lint` binary and report through the same diagnostic stream as built-ins.

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "plugins": [{
      "transform": "@ttsc/lint",
      "plugins": { "demo": "ttsc-lint-plugin-demo" },
      "rules": { "demo/no-todo-comment": "error" }
    }]
  }
}
```

Authoring instructions and the public Go API live in the [Reference Plugins guide](https://ttsc.dev/docs/development/reference/reference-plugins#authoring-a-lint-rule-contributor).

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `ttsc` development.
