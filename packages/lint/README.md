# `@ttsc/lint`

![banner of @ttsc/lint](https://raw.githubusercontent.com/samchon/ttsc/refs/heads/master/assets/og.jpg)

[![NPM Version](https://img.shields.io/npm/v/@ttsc/lint.svg)](https://www.npmjs.com/package/@ttsc/lint)
[![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/lint.svg)](https://www.npmjs.com/package/@ttsc/lint)
[![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest)
[![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

`@ttsc/lint` lets `ttsc` report lint problems in the same command that already
type-checks and builds your TypeScript project.

Use it when you want one `tsconfig.json`, one compiler command, and one stream
of diagnostics instead of running a separate linter beside `ttsc`.

## Setup

Install `ttsc` and the lint plugin:

```bash
npm install -D ttsc @ttsc/lint
```

Then add it to `compilerOptions.plugins`.

`@ttsc/lint` must be the first active plugin entry. It reads your original
source code; if another plugin rewrites the source first, the lint result no
longer describes the code you wrote.

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@ttsc/lint",
        "rules": {
          "no-var": "error",
          "no-explicit-any": "warn",
          "no-debugger": "error"
        }
      },

      // Put source-transforming plugins after @ttsc/lint.
    ]
  }
}
```

Run your normal `ttsc` command:

```bash
npx ttsc --noEmit
npx ttsc
npx ttsc --watch
```

Lint errors fail the command. Lint warnings are printed but do not change the
exit code.

## Choosing Rules

Rules are off until you enable them. Start with a few rules that match the
problem you actually want to prevent, then add more as the project settles.

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@ttsc/lint",
        "rules": {
          "no-var": "error",
          "eqeqeq": "error",
          "prefer-template": "warn",
          "no-explicit-any": "warn",
          "no-non-null-assertion": "off"
        }
      }
    ]
  }
}
```

Each rule accepts the same severity style people know from ESLint:

```jsonc
{
  "rules": {
    "no-var": "error",
    "no-explicit-any": "warn",
    "no-console": "off"
  }
}
```

Numeric severities also work: `2` is error, `1` is warning, and `0` is off.

## What To Expect

`ttsc --noEmit` checks types and lint rules without writing output.

`ttsc` checks types, runs lint, and emits JavaScript when the project is clean.
If a rule configured as `"error"` fails, the command exits non-zero.

`ttsc --watch` keeps the same behavior while files change, so type errors and
lint violations appear together.

## Current Scope

This package is a practical lint plugin for `ttsc`, not a full ESLint
replacement. It is useful for compiler-hosted rules that can run from the same
TypeScript-Go `Program` and `Checker` as the build.

Today it is diagnostic-only:

- no autofix
- no recommended preset
- no cross-file lint rules
- no custom rule loading from user projects

The rule corpus is tested in `tests/lint/cases/*.ts`. That directory is the
best way to confirm whether a rule catches the pattern you care about.

## Troubleshooting

If no lint messages appear, check that the rule is enabled. Rules default to
off.

If `@ttsc/lint` reports that it must be first, move it to the beginning of
`compilerOptions.plugins`. Disabled plugin entries are ignored, but every active
source-transforming plugin must come after lint.

If a rule name is misspelled, `@ttsc/lint` prints a warning and continues. The
rule will not run until the name is corrected.

## Status

`@ttsc/lint` is still a reference implementation for the `ttsc` plugin host.
The long-term preferred outcome is for the ESLint / `@typescript-eslint`
maintainers to own this integration. Until then, this package is the canonical
lint plugin shipped with `ttsc`.
