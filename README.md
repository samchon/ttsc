# `ttsc`

![banner of ttsc](https://raw.githubusercontent.com/samchon/ttsc/refs/heads/master/assets/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE)
[![NPM Version](https://img.shields.io/npm/v/ttsc.svg)](https://www.npmjs.com/package/ttsc)
[![NPM Downloads](https://img.shields.io/npm/dm/ttsc.svg)](https://www.npmjs.com/package/ttsc)
[![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest)
[![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://github.com/samchon/ttsc/tree/master/docs)
[![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

A `typescript-go` toolchain for compiler-powered plugins and type-safe execution.

- **`ttsc`**: build, check, and transform.
- **`ttsx`**: execute TypeScript with type checking.
  - 10x faster than `ts-node`.
  - type checking that `tsx` does not provide.
- **plugin support**: compiler-powered libraries, such as `typia`.
  - `@ttsc/lint`: lint violations as TS compile errors.

## Setup

### Install

Install the native TypeScript preview package with `ttsc`:

```bash
npm install -D ttsc @typescript/native-preview
```

### Commands

Run TypeScript directly with `ttsx` (CLI command):

```bash
npx ttsx src/index.ts
```

Build, check, or watch the project with `ttsc`:

```bash
npx ttsc
npx ttsc --noEmit
npx ttsc --watch
```

### Bundlers

Use `@ttsc/unplugin` when a bundler owns your build.

It runs `ttsc` plugins inside supported bundlers.

```bash
npm install -D ttsc @typescript/native-preview
npm install -D @ttsc/unplugin
```

Minimal Vite setup:

```ts
// vite.config.ts
import ttsc from "@ttsc/unplugin/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [ttsc()],
});
```

Supported bundlers:

- Vite
- Rollup
- Rolldown
- esbuild
- Webpack
- Rspack
- Next.js
- Farm
- Bun

See [`@ttsc/unplugin`](https://github.com/samchon/ttsc/tree/master/packages/unplugin) for full setup and adapter options.

## Plugins

Plugins let libraries add compile-time checks, transforms, and type-driven code
generation to normal `ttsc` and `ttsx` runs.

```bash
# compile
npx ttsc

# execute
npx ttsx src/index.ts
```

### Transform Example

A transform uses TypeScript types to generate JavaScript before runtime.

```ts
import typia, { tags } from "typia";
import { v4 } from "uuid";

const matched: boolean = typia.is<IMember>({
  id: v4(),
  email: "samchon.github@gmail.com",
  age: 30,
});
console.log(matched); // true

interface IMember {
  id: string & tags.Format<"uuid">;
  email: string & tags.Format<"email">;
  age: number &
    tags.Type<"uint32"> &
    tags.ExclusiveMinimum<19> &
    tags.Maximum<100>;
}
```

The transform replaces `typia.is<IMember>()` with dedicated JavaScript checks at
build time. `ttsx` applies the same transform when running the file directly.

### List of Plugins

`ttsc` ships a few small utility plugins in this repository.

- [`@ttsc/banner`](https://github.com/samchon/ttsc/tree/master/packages/banner): adds `@packageDocumentation` JSDoc banners.
- [`@ttsc/lint`](https://github.com/samchon/ttsc/tree/master/packages/lint): reports lint violations as TypeScript compile errors.
- [`@ttsc/paths`](https://github.com/samchon/ttsc/tree/master/packages/paths): rewrites source path aliases so JS and declaration emit receive relative imports.
- [`@ttsc/strip`](https://github.com/samchon/ttsc/tree/master/packages/strip): removes configured calls and `debugger` statements.
- [`@ttsc/unplugin`](https://github.com/samchon/ttsc/tree/master/packages/unplugin): runs `ttsc` plugins inside bundlers supported by `unplugin`.

Plugin authors should start from the [`Guide Documents`](https://github.com/samchon/ttsc/tree/master/docs).

Ecosystem plugins are listed below; PRs adding `ttsc` plugins are welcome.

- [`@nestia/core`](https://github.com/samchon/nestia): generates NestJS routes, OpenAPI, and SDKs.
- [`typia`](https://github.com/samchon/typia): generates validators, serializers, and type-driven runtime code.

## References

- TypeScript runners: [`ts-node`](https://github.com/TypeStrong/ts-node) and [`tsx`](https://github.com/privatenumber/tsx)
- Transformer tooling: [`ttypescript`](https://github.com/cevek/ttypescript) and [`ts-patch`](https://github.com/nonara/ts-patch)
- Inspired by: [`typical`](https://github.com/elliots/typical) and [`tsgonest`](https://github.com/tsgonest/tsgonest)
