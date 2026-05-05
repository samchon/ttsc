# `@ttsc/banner`

![banner of @ttsc/banner](https://raw.githubusercontent.com/samchon/ttsc/refs/heads/master/assets/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE)
[![NPM Version](https://img.shields.io/npm/v/@ttsc/banner.svg)](https://www.npmjs.com/package/@ttsc/banner)
[![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/banner.svg)](https://www.npmjs.com/package/@ttsc/banner)
[![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest)
[![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://github.com/samchon/ttsc/tree/master/docs)
[![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

`@ttsc/banner` adds a fixed `@packageDocumentation` JSDoc banner to JavaScript and declaration emit.

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
        "banner": "License MIT (c) 2026 Acme"
      }
    ]
  }
}
```

Run your normal `ttsc` command:

```bash
npx ttsc
```

The plugin formats every banner line inside a compiler-owned JSDoc block and adds `@packageDocumentation`. The banner follows TypeScript's normal comment emit policy, so `removeComments: true` removes it.

## Notes

`@ttsc/banner` can be used with other `ttsc` plugins:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      // Keep lint first.
      { "transform": "@ttsc/lint", "config": { "no-var": "error" } },

      // First-party utilities use their documented source/emit hook order.
      { "transform": "@ttsc/banner", "banner": "License MIT" },
      { "transform": "@ttsc/paths" },
      { "transform": "@ttsc/strip", "calls": ["console.log"] }
    ]
  }
}
```
