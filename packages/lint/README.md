# `@ttsc/lint`

![banner of @ttsc/lint](https://raw.githubusercontent.com/samchon/ttsc/refs/heads/master/assets/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE)
[![NPM Version](https://img.shields.io/npm/v/@ttsc/lint.svg)](https://www.npmjs.com/package/@ttsc/lint)
[![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/lint.svg)](https://www.npmjs.com/package/@ttsc/lint)
[![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest)
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
        "rules": {
          "no-var": "error",
          "no-explicit-any": "warn",
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

## Rules

Rules are off until you enable them:

```jsonc
{
  "rules": {
    "no-var": "error",
    "eqeqeq": "error",
    "prefer-template": "warn",
    "no-non-null-assertion": "off"
  }
}
```

String severities follow the familiar ESLint style: `"error"`, `"warn"`, and `"off"`. Numeric severities also work: `2`, `1`, and `0`.

The rule corpus is tested in `tests/lint/cases/*.ts`, which is the best place to check the exact patterns currently covered.

## Notes

`@ttsc/lint` must be the first active plugin entry because it reports on the source code you wrote. Output plugins such as `@ttsc/banner`, `@ttsc/paths`, and `@ttsc/strip` can come after it.

```jsonc
{
  "compilerOptions": {
    "plugins": [
      // Keep lint first.
      { "transform": "@ttsc/lint", "rules": { "no-var": "error" } },

      // Output plugins run after emit, in order.
      { "transform": "@ttsc/banner", "banner": "/*! @license MIT */" },
      { "transform": "@ttsc/paths" },
      { "transform": "@ttsc/strip", "calls": ["console.log"] }
    ]
  }
}
```

This package is diagnostic-only today: no autofix, no recommended preset, no custom rule loading, and no cross-file lint rules.
