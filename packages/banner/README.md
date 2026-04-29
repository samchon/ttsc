# `@ttsc/banner`

![banner of @ttsc/banner](https://raw.githubusercontent.com/samchon/ttsc/refs/heads/master/assets/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE)
[![NPM Version](https://img.shields.io/npm/v/@ttsc/banner.svg)](https://www.npmjs.com/package/@ttsc/banner)
[![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/banner.svg)](https://www.npmjs.com/package/@ttsc/banner)
[![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest)
[![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

`@ttsc/banner` prepends a fixed comment to emitted JavaScript and declaration files.

## Setup

Install `ttsc`, TypeScript-Go, and the banner plugin:

```bash
npm install -D ttsc @typescript/native-preview @ttsc/banner
```

Open your project's `tsconfig.json`, then add this entry under `compilerOptions.plugins`. If the file already has `compilerOptions`, merge this into the existing object:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@ttsc/banner",
        "banner": "/*! @license MIT (c) 2026 Acme */"
      }
    ]
  }
}
```

Run your normal `ttsc` command:

```bash
npx ttsc
```

The banner is written to emitted `.js`, `.mjs`, `.cjs`, `.d.ts`, `.d.mts`, and `.d.cts` files. Source maps and build-info files are left unchanged.

## Notes

`@ttsc/banner` can be used with other `ttsc` plugins:

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
