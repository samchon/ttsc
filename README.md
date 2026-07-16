# `ttsc`

![banner of ttsc](https://ttsc.dev/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/ttsc.svg)](https://www.npmjs.com/package/ttsc) [![NPM Downloads](https://img.shields.io/npm/dm/ttsc.svg)](https://www.npmjs.com/package/ttsc) [![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest) [![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

A `typescript-go` toolchain for compiler-powered plugins and type-safe execution.

- **`ttsc`**: build, check, and transform.
- **`ttsx`**: execute TypeScript with type checking.
- [**`@ttsc/lint`**](https://github.com/samchon/ttsc/tree/master/packages/lint): lint violations as compiler errors.
- [**`@ttsc/graph`**](https://github.com/samchon/ttsc/tree/master/packages/graph): MCP code graph that reduces agent token usage.
- **plugin support**: compiler-powered libraries, such as `typia`.

## Guide Documents

- [Introduction](https://ttsc.dev/docs)
- Setup
  - [Getting Started](https://ttsc.dev/docs/setup)
  - [CLI & Scripts](https://ttsc.dev/docs/setup/ttsc)
  - [Lint & Format](https://ttsc.dev/docs/setup/lint)
  - [Bundlers (unplugin)](https://ttsc.dev/docs/setup/unplugin)
  - [React Native (Metro)](https://ttsc.dev/docs/setup/metro)
  - [VS Code](https://ttsc.dev/docs/setup/vscode)
  - [Coding Agents (MCP)](https://ttsc.dev/docs/setup/graph)
- Compiler
  - [Compile (ttsc)](https://ttsc.dev/docs/ttsc/compile)
  - [Execute (ttsx)](https://ttsc.dev/docs/ttsc/execute)
  - [Flags](https://ttsc.dev/docs/ttsc/flags)
- Lint & Format
  - [Overview](https://ttsc.dev/docs/lint)
  - [Setup](https://ttsc.dev/docs/lint/setup)
  - [Format](https://ttsc.dev/docs/lint/format)
  - [Rules](https://ttsc.dev/docs/lint/rules)
- Code Graph (MCP)
  - [Overview](https://ttsc.dev/docs/graph)
  - [Comparison](https://ttsc.dev/docs/graph/compare)
  - [3D Viewer](https://ttsc.dev/docs/graph/viewer)
- Benchmark
  - [Overview](https://ttsc.dev/docs/benchmark)
  - [Code Graph](https://ttsc.dev/docs/benchmark/graph)
  - [Compiler Performance](https://ttsc.dev/docs/benchmark/performance)
- [Plugin Development](https://ttsc.dev/docs/development)
- [Playground](https://ttsc.dev/docs/playground)
- [FAQ](https://ttsc.dev/docs/faq)

## Setup

Install `ttsc`, `@ttsc/lint`, and the native TypeScript compiler:

```bash
npm install -D ttsc @ttsc/lint typescript
```

```bash
npx ttsx src/index.ts   # run a file, type-checked first
npx ttsc                # build
npx ttsc --noEmit       # check only
npx ttsc --watch        # rebuild on save
npx ttsc format         # format source files in place
```

`ttsc` reads the `tsconfig.json` you already have, same fields as `tsc`. Setup for the other surfaces is in the guide:

- [Bundlers](https://ttsc.dev/docs/setup/unplugin): `@ttsc/unplugin` adapters for Vite, Rollup, Rolldown, esbuild, webpack, Rspack, Next.js, Turbopack, Farm, and Bun.
- [React Native / Expo](https://ttsc.dev/docs/setup/metro): `@ttsc/metro`, the Metro transformer.
- [VS Code](https://ttsc.dev/docs/setup/vscode): editor diagnostics that match your build, plus format on save.

## Lint

`@ttsc/lint` folds ESLint's job and Prettier's job into the compile: one `lint.config.ts`, one pass, one exit code. A lint violation fails the build through the same stream as a type error.

```ts
// lint.config.ts
import type { ITtscLintConfig } from "@ttsc/lint";

export default {
  rules: {
    "no-var": "error",
    "prefer-const": "error",
    "typescript/no-explicit-any": "warning",
  },
  format: {
    printWidth: 100,
    singleQuote: true,
    trailingComma: "all",
  },
} satisfies ITtscLintConfig;
```

`npx ttsc fix` applies every fixable violation; `npx ttsc format` applies format edits only. The rule catalog and the format keys are in [Lint & Format](https://ttsc.dev/docs/lint).

## Graph

`@ttsc/graph` hands a coding agent a checker-resolved graph of your project, over MCP. It answers what relates to a symbol and what a change affects straight from the type checker, so the agent stops grepping and re-reading files.

```bash
npm install -D ttsc @ttsc/graph typescript
```

Point your agent's MCP client at it. For Claude Code, a `.mcp.json` in the project root:

```json
{
  "mcpServers": {
    "ttsc-graph": {
      "command": "npx",
      "args": ["-y", "@ttsc/graph"]
    }
  }
}
```

On the agent-cost benchmark, Claude agents answer reading zero files, cutting tokens by roughly 90% and tool calls by 93% to 96%. See [Code Graph](https://ttsc.dev/docs/graph) and the [benchmark](https://ttsc.dev/docs/benchmark/graph).

## Plugins

Plugins let libraries add compile-time checks, transforms, and type-driven code generation to normal `ttsc` and `ttsx` runs.

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

The transform replaces `typia.is<IMember>()` with dedicated JavaScript checks at build time:

```js
import typia from "typia";
import * as __typia_transform__isFormatEmail from "typia/lib/internal/_isFormatEmail";
import * as __typia_transform__isFormatUuid from "typia/lib/internal/_isFormatUuid";
import * as __typia_transform__isTypeUint32 from "typia/lib/internal/_isTypeUint32";
import { v4 } from "uuid";

const matched = (() => {
  const _io0 = (input) =>
    "string" === typeof input.id &&
    __typia_transform__isFormatUuid._isFormatUuid(input.id) &&
    "string" === typeof input.email &&
    __typia_transform__isFormatEmail._isFormatEmail(input.email) &&
    "number" === typeof input.age &&
    __typia_transform__isTypeUint32._isTypeUint32(input.age) &&
    19 < input.age &&
    input.age <= 100;
  return (input) => "object" === typeof input && null !== input && _io0(input);
})()({
  id: v4(),
  email: "samchon.github@gmail.com",
  age: 30,
});
console.log(matched); // true
```

### List of Plugins

`ttsc` ships a few small utility plugins in this repository.

- [`@ttsc/banner`](https://github.com/samchon/ttsc/tree/master/packages/banner): adds `@packageDocumentation` JSDoc banners.
- [`@ttsc/lint`](https://github.com/samchon/ttsc/tree/master/packages/lint): lints and formats TypeScript source.
- [`@ttsc/graph`](https://github.com/samchon/ttsc/tree/master/packages/graph): MCP server exposing a checker-resolved code graph to coding agents.
- [`@ttsc/paths`](https://github.com/samchon/ttsc/tree/master/packages/paths): rewrites source path aliases so JS and declaration emit receive relative imports.
- [`@ttsc/strip`](https://github.com/samchon/ttsc/tree/master/packages/strip): removes configured calls and `debugger` statements.
- [`@ttsc/unplugin`](https://github.com/samchon/ttsc/tree/master/packages/unplugin): runs `ttsc` plugins inside bundlers supported by `unplugin`.
- [`@ttsc/metro`](https://github.com/samchon/ttsc/tree/master/packages/metro): runs `ttsc` plugins inside Metro for React Native and Expo.

Plugin authors should start from the [`Guide Documents`](https://ttsc.dev/docs).

Ecosystem plugins are listed below; PRs adding `ttsc` plugins are welcome.

- [`nestia`](https://github.com/samchon/nestia): generates NestJS routes, OpenAPI, and SDKs.
- [`typia`](https://github.com/samchon/typia): generates validators, serializers, and type-driven runtime code.

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `ttsc` development.

## References

- TypeScript runners: [`ts-node`](https://github.com/TypeStrong/ts-node) and [`tsx`](https://github.com/privatenumber/tsx)
- Transformer tooling: [`ttypescript`](https://github.com/cevek/ttypescript) and [`ts-patch`](https://github.com/nonara/ts-patch)
- Inspired by: [`typical`](https://github.com/elliots/typical), [`tsgonest`](https://github.com/tsgonest/tsgonest) and [`codegraph`](https://github.com/colbymchenry/codegraph).
