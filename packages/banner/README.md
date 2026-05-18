# `@ttsc/banner`

![banner of @ttsc/banner](https://ttsc.dev/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE)
[![NPM Version](https://img.shields.io/npm/v/@ttsc/banner.svg)](https://www.npmjs.com/package/@ttsc/banner)
[![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/banner.svg)](https://www.npmjs.com/package/@ttsc/banner)
[![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest)
[![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs)
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

`banner.config.ts` is the only config surface. The plugin formats every line of `text` inside a JSDoc block and appends `@packageDocumentation`.

The banner follows TypeScript's normal comment emit policy, so `removeComments: true` removes it.

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `ttsc` development.
