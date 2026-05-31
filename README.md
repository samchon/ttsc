# `ttsc`

![banner of ttsc](https://ttsc.dev/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/ttsc.svg)](https://www.npmjs.com/package/ttsc) [![NPM Downloads](https://img.shields.io/npm/dm/ttsc.svg)](https://www.npmjs.com/package/ttsc) [![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest) [![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

A `typescript-go` toolchain for compiler-powered plugins and type-safe execution.

Benchmarked against the legacy `tsc` + `eslint`/`prettier` path on real repositories; see the [benchmark guide](https://ttsc.dev/docs/benchmark) for per-project ratios.

- **`ttsc`**: build, check, and transform.
- **`ttsx`**: execute TypeScript with type checking.
  - native TypeScript-Go execution instead of transpile-only runners.
  - type checking that `tsx` does not provide.
- **`@ttsc/lint`**: replaces `eslint` and `prettier`.
  - lint violations as TS compile errors.
  - format autofixes via `ttsc format`.
- **plugin support**: compiler-powered libraries, such as `typia`.

## Setup

### Install

Install `ttsc`, `@ttsc/lint`, and the native TypeScript preview package:

```bash
npm install -D ttsc @ttsc/lint @typescript/native-preview
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

Rewrite source files in place with the `@ttsc/lint` format rules:

```bash
npx ttsc format
```

### VS Code Extension

Install the VS Code extension for live TypeScript-Go editor features plus saved-state ttsc plugin diagnostics and actions.

Install it from the VS Code Marketplace by searching `ttsc`, or run:

```bash
npx @ttsc/vscode
```

Then turn on format-on-save in `.vscode/settings.json`:

```jsonc
"[typescript][typescriptreact]": {
  "editor.defaultFormatter": "samchon.ttsc",
  "editor.formatOnSave": true
}
```

Lint fixes stay off-save by default; opt in with `"editor.codeActionsOnSave": { "source.fixAll.ttsc": "explicit" }`.

See [`@ttsc/vscode`](https://github.com/samchon/ttsc/tree/master/packages/vscode) for requirements and settings.

### Bundlers

Use `@ttsc/unplugin` when a bundler owns your build.

It runs `ttsc` plugins inside supported bundlers.

```bash
npm install -D ttsc @ttsc/lint @typescript/native-preview
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

## Programmatic API

Embed `ttsc` from another Node tool with the `TtscCompiler` class:

```ts
import { TtscCompiler } from "ttsc";

const compiler = new TtscCompiler({ cwd: "./project" });
const result = compiler.compile();

if (result.type === "success") {
  for (const [path, text] of Object.entries(result.output)) {
    // path is project-relative ("dist/index.js", "dist/index.d.ts", ...)
    console.log(path, text.length);
  }
} else if (result.type === "failure") {
  for (const d of result.diagnostics) {
    console.error(`${d.file}:${d.line}:${d.character} ${d.messageText}`);
  }
}
```

See the [Programmatic API guide](https://ttsc.dev/docs/ttsc/api) for the full lifecycle, plugin overrides, and patterns. For browser embedding, see [`@ttsc/wasm`](https://github.com/samchon/ttsc/tree/master/packages/wasm) and the higher-level [`@ttsc/playground`](https://github.com/samchon/ttsc/tree/master/packages/playground) package.

### List of Plugins

`ttsc` ships a few small utility plugins in this repository.

- [`@ttsc/banner`](https://github.com/samchon/ttsc/tree/master/packages/banner): adds `@packageDocumentation` JSDoc banners.
- [`@ttsc/lint`](https://github.com/samchon/ttsc/tree/master/packages/lint): lints and formats TypeScript source.
- [`@ttsc/paths`](https://github.com/samchon/ttsc/tree/master/packages/paths): rewrites source path aliases so JS and declaration emit receive relative imports.
- [`@ttsc/strip`](https://github.com/samchon/ttsc/tree/master/packages/strip): removes configured calls and `debugger` statements.
- [`@ttsc/unplugin`](https://github.com/samchon/ttsc/tree/master/packages/unplugin): runs `ttsc` plugins inside bundlers supported by `unplugin`.

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
- Inspired by: [`typical`](https://github.com/elliots/typical) and [`tsgonest`](https://github.com/tsgonest/tsgonest)
