# `@ttsc/banner`

![banner of @ttsc/banner](https://raw.githubusercontent.com/samchon/ttsc/refs/heads/master/assets/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE)
[![NPM Version](https://img.shields.io/npm/v/@ttsc/banner.svg)](https://www.npmjs.com/package/@ttsc/banner)
[![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/banner.svg)](https://www.npmjs.com/package/@ttsc/banner)
[![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest)
[![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://github.com/samchon/ttsc/tree/master/docs)
[![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

`@ttsc/banner` adds a fixed `@packageDocumentation` JSDoc banner to the output.

## Setup

Install `ttsc` and TypeScript-Go, then the banner plugin:

```bash
npm install -D ttsc @typescript/native-preview
npm install -D @ttsc/banner
```

Add `banner.config.ts` next to your project config:

```ts
// banner.config.ts
import type { TtscBannerConfig } from "@ttsc/banner";

export default {
  text: "License MIT (c) 2026 Acme",
} satisfies TtscBannerConfig;
```

Run your normal `ttsc` command:

```bash
npx ttsc
```

If `@ttsc/banner` is installed and no banner config file can be found, the compile fails.

## Configuration

Use `banner.config.ts` for ordinary projects.

Use `compilerOptions.plugins` only when the project needs a different config file path or inline text:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@ttsc/banner",
        "config": "./config/banner.config.ts",
      },
    ],
  },
}
```

The explicit `config` path resolves from the selected `tsconfig.json` directory.

Existing inline text config remains supported:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@ttsc/banner",
        "text": "License MIT (c) 2026 Acme",
      },
    ],
  },
}
```

The plugin formats every banner line inside a JSDoc block and adds `@packageDocumentation`. The banner follows TypeScript's normal comment emit policy, so `removeComments: true` removes it.
