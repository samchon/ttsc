# `@ttsc/strip`

![banner of @ttsc/strip](https://raw.githubusercontent.com/samchon/ttsc/refs/heads/master/assets/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE)
[![NPM Version](https://img.shields.io/npm/v/@ttsc/strip.svg)](https://www.npmjs.com/package/@ttsc/strip)
[![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/strip.svg)](https://www.npmjs.com/package/@ttsc/strip)
[![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest)
[![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

`@ttsc/strip` removes configured call-expression statements and debugger statements from emitted JavaScript.

## Setup

Install `ttsc`, TypeScript-Go, and the strip plugin:

```bash
npm install -D ttsc @typescript/native-preview @ttsc/strip
```

Open your project's `tsconfig.json`, then add this entry under `compilerOptions.plugins`. If the file already has `compilerOptions`, merge this into the existing object:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@ttsc/strip",
        "calls": ["console.log", "console.debug", "assert.*"],
        "statements": ["debugger"]
      }
    ]
  }
}
```

Run your normal `ttsc` command:

```bash
npx ttsc
```

Only the configured patterns are removed. `@ttsc/strip` is not a minifier, tree-shaker, or dead-code-elimination pass.

## Notes

Call patterns match statement-level calls such as `console.log("debug")` or `assert.equal(left, right)`. A wildcard is supported at the end of a dotted call pattern, such as `assert.*`.

```jsonc
{
  "compilerOptions": {
    "plugins": [
      // Keep lint first.
      { "transform": "@ttsc/lint", "rules": { "no-var": "error" } },

      // Output plugins run after emit, in order.
      { "transform": "@ttsc/banner", "banner": "/*! @license MIT */" },
      { "transform": "@ttsc/paths" },
      {
        "transform": "@ttsc/strip",
        "calls": ["console.log", "console.debug", "assert.*"],
        "statements": ["debugger"]
      }
    ]
  }
}
```
