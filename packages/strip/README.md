# `@ttsc/strip`

![banner of @ttsc/strip](https://ttsc.dev/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/@ttsc/strip.svg)](https://www.npmjs.com/package/@ttsc/strip) [![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/strip.svg)](https://www.npmjs.com/package/@ttsc/strip) [![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest) [![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

`@ttsc/strip` removes configured debug calls and `debugger` statements from TypeScript source AST before emit.

## Setup

Install `ttsc` and TypeScript-Go, then the strip plugin:

```bash
npm install -D ttsc typescript
npm install -D @ttsc/strip
```

Run your normal `ttsc` command:

```bash
npx ttsc
```

With no extra config, `@ttsc/strip` removes `console.log`, `console.debug`, `assert.*`, and `debugger`.

Only the configured patterns are removed. `@ttsc/strip` is not a minifier, tree-shaker, or dead-code-elimination pass.

Stripping removes the entire statement, including its arguments. A side-effecting call nested inside a stripped statement-level call goes with it: `console.log(recordMetric())` drops `recordMetric()` along with the `console.log` statement.

## Configuration

Default behavior removes these statement patterns:

```json
{
  "calls": ["console.log", "console.debug", "assert.*"],
  "statements": ["debugger"]
}
```

Call patterns match statement-level calls such as `console.log("debug")` or `assert.equal(left, right)`. A wildcard is supported at the end of a dotted call pattern, such as `assert.*`.

To customize the strip list, add a `strip.config.ts` next to your `tsconfig.json`:

```ts
// strip.config.ts
import type { ITtscStripConfig } from "@ttsc/strip";

export default {
  calls: ["console.log", "console.debug", "assert.*"],
  statements: ["debugger"],
} satisfies ITtscStripConfig;
```

`@ttsc/strip` discovers its config by walking upward from the tsconfig directory, looking for `strip.config.{ts,cts,mts,js,cjs,mjs,json}`. To point at a specific file, set `configFile` on the tsconfig entry:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      { "transform": "@ttsc/strip", "configFile": "./config/strip.config.ts" }
    ]
  }
}
```

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `ttsc` development.
