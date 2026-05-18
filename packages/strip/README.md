# `@ttsc/strip`

![banner of @ttsc/strip](https://ttsc.dev/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE)
[![NPM Version](https://img.shields.io/npm/v/@ttsc/strip.svg)](https://www.npmjs.com/package/@ttsc/strip)
[![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/strip.svg)](https://www.npmjs.com/package/@ttsc/strip)
[![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest)
[![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs)
[![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

`@ttsc/strip` removes configured debug calls and `debugger` statements from TypeScript source AST before emit.

## Setup

Install `ttsc` and TypeScript-Go, then the strip plugin:

```bash
npm install -D ttsc @typescript/native-preview
npm install -D @ttsc/strip
```

Run your normal `ttsc` command:

```bash
npx ttsc
```

With no extra config, `@ttsc/strip` removes `console.log`, `console.debug`, `assert.*`, and `debugger`.

Only the configured patterns are removed. `@ttsc/strip` is not a minifier, tree-shaker, or dead-code-elimination pass.

## Configuration

Default behavior removes these statement patterns:

```json
{
  "calls": ["console.log", "console.debug", "assert.*"],
  "statements": ["debugger"]
}
```

Call patterns match statement-level calls such as `console.log("debug")` or `assert.equal(left, right)`. A wildcard is supported at the end of a dotted call pattern, such as `assert.*`.

Add a direct plugin config only when the project needs a different strip list:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@ttsc/strip",
        "calls": ["console.log", "console.debug", "assert.*"],
        "statements": ["debugger"],
      },
    ],
  },
}
```

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `ttsc` development.
