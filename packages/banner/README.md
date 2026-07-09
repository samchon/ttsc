# `@ttsc/banner`

![banner of @ttsc/banner](https://ttsc.dev/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/@ttsc/banner.svg)](https://www.npmjs.com/package/@ttsc/banner) [![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/banner.svg)](https://www.npmjs.com/package/@ttsc/banner) [![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest) [![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

`@ttsc/banner` adds a fixed `@packageDocumentation` JSDoc banner to the output.

## Setup

Install `ttsc` and TypeScript-Go, then the banner plugin:

```bash
npm install -D ttsc typescript
npm install -D @ttsc/banner
```

Register the plugin in your `tsconfig.json`:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "plugins": [
      { "transform": "@ttsc/banner" }
    ]
  }
}
```

Drop a `banner.config.ts` next to your `tsconfig.json`:

```ts
// banner.config.ts
import type { ITtscBannerConfig } from "@ttsc/banner";

export default {
  text: "License MIT (c) 2026 Acme",
} satisfies ITtscBannerConfig;
```

A `banner.config.*` file always exports an object with a `text` string.

Run your normal `ttsc` command:

```bash
npx ttsc
```

If `@ttsc/banner` is installed and no `banner.config.*` file is found, the compile fails.

## Configuration

`@ttsc/banner` discovers its config by walking upward from the tsconfig directory, looking for `banner.config.{ts,cts,mts,js,cjs,mjs,json}`.

To point at a specific file instead of using auto-discovery, set `configFile` on the tsconfig entry:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "plugins": [
      { "transform": "@ttsc/banner", "configFile": "./config/banner.config.ts" }
    ]
  }
}
```

The plugin formats every line of the resolved text inside a JSDoc block and appends `@packageDocumentation`.

The banner follows TypeScript's normal comment emit policy, so `removeComments: true` removes it.

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `ttsc` development.
