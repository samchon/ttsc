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

`ttsc` is a drop-in replacement for `tsc`. It reads the same `tsconfig.json`, takes the same flags, and emits the same JavaScript, then runs your plugins in the pass that type-checks the project.

```bash
npm install -D ttsc typescript
```

```bash
npx ttsx src/index.ts   # run a file, type-checked first
npx ttsc                # build
npx ttsc --noEmit       # check only
npx ttsc --watch        # rebuild on save
```

`ttsx` runs a file the way `tsx` or `ts-node` does, but it type-checks the whole project first, so a type error stops the run before anything executes.

That covers the CLI. The integrations each have a short guide: [bundlers](https://ttsc.dev/docs/setup/unplugin) for Vite, webpack, and Next.js; [Metro](https://ttsc.dev/docs/setup/metro) for React Native and Expo; the [VS Code extension](https://ttsc.dev/docs/setup/vscode) for live editor diagnostics.

## Lint

`@ttsc/lint` replaces ESLint and Prettier with rules that run inside the type-check. It shares one AST pass with the compiler, so linting and formatting add almost nothing to the build you already run.

Configuration is a single file. Each rule takes `"error"`, `"warning"`, or `"off"`, and the `format` block mirrors `.prettierrc`.

```bash
npm install -D @ttsc/lint
```

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

Violations surface as compiler diagnostics, in the same stream as type errors, so the CI step that already runs `ttsc --noEmit` gates lint without a second job:

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

Clean the project in place with `ttsc fix` (lint autofixes plus formatting) or `ttsc format` (formatting only, which never changes behavior). The rule catalog and every `format` key are in the [Lint & Format guide](https://ttsc.dev/docs/lint).

## Graph

`@ttsc/graph` is an MCP server that gives a coding agent a compiler-resolved graph of your project: what calls what, what a change would touch, and where to start reading. Without it, an agent rebuilds that map by opening files and following imports, spending tokens on every hop and guessing at the edges it cannot see.

Because the graph comes from the real type checker, the relationships a text search gets wrong are exact here: `tsconfig` path aliases, cross-package calls in a monorepo, and barrel re-exports all resolve to the true declaration.

![Median tokens on the shared onboarding question, lower is better](https://ttsc.dev/benchmark/svg/graph-common-codex-gpt-5.6-terra.svg)

```bash
npm install -D ttsc @ttsc/graph typescript
```

Register it with your MCP client. For Claude Code, a `.mcp.json` in the project root:

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

On the agent-cost benchmark, Claude agents answer reading zero files, cutting tokens by roughly 90% and tool calls by 93% to 96%. The design and per-repository numbers are in the [Code Graph guide](https://ttsc.dev/docs/graph) and the [benchmark](https://ttsc.dev/docs/benchmark/graph).

## Plugins

Plugins let a library add compile-time checks, transforms, and type-driven code generation to ordinary `ttsc` and `ttsx` runs. [typia](https://typia.io), for example, turns a TypeScript type into a runtime validator at build time:

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

## References

- TypeScript runners: [`ts-node`](https://github.com/TypeStrong/ts-node) and [`tsx`](https://github.com/privatenumber/tsx)
- Transformer tooling: [`ttypescript`](https://github.com/cevek/ttypescript) and [`ts-patch`](https://github.com/nonara/ts-patch)
- Inspired by: [`typical`](https://github.com/elliots/typical), [`tsgonest`](https://github.com/tsgonest/tsgonest) and [`codegraph`](https://github.com/colbymchenry/codegraph).
