# `ttsc`

![banner of ttsc](https://ttsc.dev/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/ttsc.svg)](https://www.npmjs.com/package/ttsc) [![NPM Downloads](https://img.shields.io/npm/dm/ttsc.svg)](https://www.npmjs.com/package/ttsc) [![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest) [![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

A `typescript-go` toolchain for compiler-powered plugins and type-safe execution.

- **`ttsc`**: build, check, and transform.
- **`ttsx`**: execute TypeScript with type checking.
- [**`@ttsc/lint`**](https://github.com/samchon/ttsc/tree/master/packages/lint): lint violations as compiler errors.
- [**`@ttsc/graph`**](https://github.com/samchon/ttsc/tree/master/packages/graph): MCP code graph that reduces agent token usage.
- **plugin support**: compiler-powered libraries, such as `typia`.

## Setup

`ttsc` is a drop-in replacement for `tsc`. It reads the same `tsconfig.json`, takes the same flags, and emits the same JavaScript, so you can swap it into an existing project and CI keeps working.

```bash
npm install -D ttsc typescript
```

`typescript` sits on that line because `ttsc` runs on the native TypeScript-Go compiler, which the TypeScript team versions separately. You pin it, and `ttsc` picks it up from `node_modules`.

```bash
npx ttsx src/index.ts   # run a file, type-checked first
npx ttsc                # build
npx ttsc --noEmit       # check only
npx ttsc --watch        # rebuild on save
```

`ttsx` runs a file directly, like `tsx` or `ts-node`, but it type-checks the whole project first. A type error stops the run before anything executes.

That is the core. Bundlers, React Native, and the editor each have a one-page guide:

- [Bundlers (Vite, webpack, Next.js, ...)](https://ttsc.dev/docs/setup/unplugin)
- [React Native / Expo (Metro)](https://ttsc.dev/docs/setup/metro)
- [VS Code extension](https://ttsc.dev/docs/setup/vscode)

## Lint

`@ttsc/lint` folds ESLint's job and Prettier's job into the compile you already run. One `lint.config.ts`, one pass over the source, one exit code.

```bash
npm install -D @ttsc/lint
```

Rules and formatting share the config. Three severities: `"error"` fails the build, `"warning"` prints, `"off"` disables.

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

A violation is not a separate report. It arrives as a compiler diagnostic, in the same stream as a type error:

```ts
// src/index.ts
var count = 3;
let total = count;
```

```text
$ npx ttsc --noEmit
src/index.ts:2:5 - error TS17397: [prefer-const] Use const instead of let.

2 let total = count;
      ~~~~~~~~~~~~~

src/index.ts:1:1 - error TS11966: [no-var] Unexpected var, use let or const instead.

1 var count = 3;
  ~~~~~~~~~~~~~~
```

So the CI step that already runs `ttsc --noEmit` gates lint too, with no second job to drift out of sync. Clean up in place:

```bash
npx ttsc fix      # every fixable lint violation + format edits
npx ttsc format   # format edits only, never changes behavior
```

The rule catalog and every `format` key are in the [Lint & Format guide](https://ttsc.dev/docs/lint).

## Graph

Ask a coding agent how something works, and on its own it reads one file, follows an import, reads the next, and repeats. Every hop spends tokens, and the relationships it infers are guesses from whatever text it happened to open.

`@ttsc/graph` replaces that crawl with the compiler's own map, served over MCP. The agent asks one tool what calls what, what a change would touch, and where to start.

Every edge is resolved by the type checker, so path aliases, monorepo boundaries, and barrel re-exports all land on the real declaration, not the text that looked close.

![Median tokens on the shared onboarding question, lower is better](https://ttsc.dev/benchmark/svg/graph-common-codex-gpt-5.6-terra.svg)

```bash
npm install -D ttsc @ttsc/graph typescript
```

Point your MCP client at it. For Claude Code, a `.mcp.json` in the project root:

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

On the agent-cost benchmark, Claude answers reading zero files, cutting tokens by roughly 90% and tool calls by 93% to 96%.

See the [Code Graph guide](https://ttsc.dev/docs/graph) and the [benchmark](https://ttsc.dev/docs/benchmark/graph).

## Plugins

Plugins let libraries add compile-time checks, transforms, and type-driven code generation to normal `ttsc` and `ttsx` runs. A transform uses TypeScript types to generate JavaScript before runtime:

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

At build time, the transform replaces `typia.is<IMember>()` with dedicated JavaScript checks:

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

Utility plugins shipped in this repository:

- [`@ttsc/banner`](https://github.com/samchon/ttsc/tree/master/packages/banner): adds `@packageDocumentation` JSDoc banners.
- [`@ttsc/lint`](https://github.com/samchon/ttsc/tree/master/packages/lint): lints and formats TypeScript source.
- [`@ttsc/graph`](https://github.com/samchon/ttsc/tree/master/packages/graph): MCP server exposing a checker-resolved code graph to coding agents.
- [`@ttsc/paths`](https://github.com/samchon/ttsc/tree/master/packages/paths): rewrites source path aliases so JS and declaration emit receive relative imports.
- [`@ttsc/strip`](https://github.com/samchon/ttsc/tree/master/packages/strip): removes configured calls and `debugger` statements.
- [`@ttsc/unplugin`](https://github.com/samchon/ttsc/tree/master/packages/unplugin): runs `ttsc` plugins inside bundlers supported by `unplugin`.
- [`@ttsc/metro`](https://github.com/samchon/ttsc/tree/master/packages/metro): runs `ttsc` plugins inside Metro for React Native and Expo.

Ecosystem plugins; PRs adding yours are welcome:

- [`nestia`](https://github.com/samchon/nestia): generates NestJS routes, OpenAPI, and SDKs.
- [`typia`](https://github.com/samchon/typia): generates validators, serializers, and type-driven runtime code.

To write one, start from [Plugin Development](https://ttsc.dev/docs/development).

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `ttsc` development.

## Guide Documents

### 🏠 Home

- [Introduction](https://ttsc.dev/docs)
- Setup
  - [CLI & Scripts](https://ttsc.dev/docs/setup/ttsc)
  - [Lint & Format](https://ttsc.dev/docs/setup/lint)
  - [Bundlers (unplugin)](https://ttsc.dev/docs/setup/unplugin)
  - [React Native (Metro)](https://ttsc.dev/docs/setup/metro)
  - [VS Code](https://ttsc.dev/docs/setup/vscode)
  - [Coding Agents (MCP)](https://ttsc.dev/docs/setup/graph)

### 📖 Features

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

### 🧰 Authoring

- [Plugin Development](https://ttsc.dev/docs/development)
- [WASM Module](https://ttsc.dev/docs/wasm)
- [Playground](https://ttsc.dev/docs/playground)

### 🔗 Appendix

- Benchmark
  - [Overview](https://ttsc.dev/docs/benchmark)
  - [Code Graph](https://ttsc.dev/docs/benchmark/graph)
  - [Compiler Performance](https://ttsc.dev/docs/benchmark/performance)
- [FAQ](https://ttsc.dev/docs/faq)

## References

- TypeScript runners: [`ts-node`](https://github.com/TypeStrong/ts-node) and [`tsx`](https://github.com/privatenumber/tsx)
- Transformer tooling: [`ttypescript`](https://github.com/cevek/ttypescript) and [`ts-patch`](https://github.com/nonara/ts-patch)
- Inspired by: [`typical`](https://github.com/elliots/typical), [`tsgonest`](https://github.com/tsgonest/tsgonest) and [`codegraph`](https://github.com/colbymchenry/codegraph).
