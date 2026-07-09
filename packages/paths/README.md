# `@ttsc/paths`

![banner of @ttsc/paths](https://ttsc.dev/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/@ttsc/paths.svg)](https://www.npmjs.com/package/@ttsc/paths) [![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/paths.svg)](https://www.npmjs.com/package/@ttsc/paths) [![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest) [![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

`@ttsc/paths` rewrites module specifiers that match `compilerOptions.paths` into relative JavaScript and declaration imports.

## Setup

Install `ttsc` and TypeScript-Go, then the paths plugin:

```bash
npm install -D ttsc typescript
npm install -D @ttsc/paths
```

Run your normal `ttsc` command:

```bash
npx ttsc
```

## Configuration

`@ttsc/paths` has no separate plugin options. It reads the same `compilerOptions.paths`, `rootDir`, and `outDir` values that `ttsc` uses for the project.

Configure those fields under `compilerOptions`:

```jsonc
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@lib/*": ["./src/modules/*"],
    },
    "rootDir": "src",
    "outDir": "dist",
  },
}
```

An import such as `import { value } from "@lib/value"` becomes a relative JavaScript import such as `import { value } from "./modules/value.js"`. Declaration output follows the same source rewrite.

`outDir` must be set for the rewrite to run. Without it, `@ttsc/paths` cannot map a source path to its emitted location and makes no changes. `rootDir` is optional: when omitted it defaults to the tsconfig's directory, matching where TypeScript-Go anchors emitted output.

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `ttsc` development.

## References

Inspired by [`typescript-transform-paths`](https://github.com/LeDDGroup/typescript-transform-paths).
