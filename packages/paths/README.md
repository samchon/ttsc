# `@ttsc/paths`

![banner of @ttsc/paths](https://raw.githubusercontent.com/samchon/ttsc/refs/heads/master/assets/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE)
[![NPM Version](https://img.shields.io/npm/v/@ttsc/paths.svg)](https://www.npmjs.com/package/@ttsc/paths)
[![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/paths.svg)](https://www.npmjs.com/package/@ttsc/paths)
[![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest)
[![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://github.com/samchon/ttsc/tree/master/docs)
[![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

`@ttsc/paths` rewrites emitted module specifiers that match `compilerOptions.paths` into relative JavaScript paths.

## Setup

Install `ttsc`, TypeScript-Go, and the paths plugin:

```bash
npm install -D ttsc @typescript/native-preview @ttsc/paths
```

Open your project's `tsconfig.json`, then configure `paths`, `rootDir`, `outDir`, and this plugin under `compilerOptions`. If the file already has `compilerOptions`, merge these fields into the existing object:

```jsonc
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@lib/*": ["./src/modules/*"]
    },
    "rootDir": "src",
    "outDir": "dist",
    "plugins": [
      { "transform": "@ttsc/paths" }
    ]
  }
}
```

Run your normal `ttsc` command:

```bash
npx ttsc
```

An emitted import such as `import { value } from "@lib/value"` becomes a relative JavaScript import such as `import { value } from "./modules/value.js"`.

## Notes

No separate plugin options are required. `@ttsc/paths` reads the same `compilerOptions.paths`, `rootDir`, and `outDir` values that `ttsc` uses for the project.

```jsonc
{
  "compilerOptions": {
    "paths": {
      "@lib/*": ["./src/modules/*"]
    },
    "rootDir": "src",
    "outDir": "dist",
    "plugins": [
      // Keep lint first.
      { "transform": "@ttsc/lint", "config": { "no-var": "error" } },

      // Output plugins run after emit, in order.
      { "transform": "@ttsc/banner", "banner": "/*! @license MIT */" },
      { "transform": "@ttsc/paths" },
      { "transform": "@ttsc/strip", "calls": ["console.log"] }
    ]
  }
}
```
