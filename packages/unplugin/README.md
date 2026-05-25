# `@ttsc/unplugin`

![banner of @ttsc/unplugin](https://ttsc.dev/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE)
[![NPM Version](https://img.shields.io/npm/v/@ttsc/unplugin.svg)](https://www.npmjs.com/package/@ttsc/unplugin)
[![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/unplugin.svg)](https://www.npmjs.com/package/@ttsc/unplugin)
[![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest)
[![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs)
[![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

Bundler adapter for `ttsc` plugins.

Use it when Vite, Rollup, esbuild, Webpack, Rspack, Next.js, Farm, or Bun owns the build but the project still needs `ttsc` plugins.

## Setup

Install `ttsc` and TypeScript-Go first. Then install the bundler adapter:

```bash
npm install -D ttsc @typescript/native-preview
npm install -D @ttsc/unplugin
```

Choose your bundler and add the adapter.

### Vite

```ts
// vite.config.ts
import ttsc from "@ttsc/unplugin/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [ttsc()],
});
```

### Rollup

```ts
// rollup.config.ts
import ttsc from "@ttsc/unplugin/rollup";

export default {
  input: "src/index.ts",
  output: {
    dir: "dist",
    format: "esm",
  },
  plugins: [ttsc()],
};
```

### Rolldown

```ts
// rolldown.config.ts
import ttsc from "@ttsc/unplugin/rolldown";

export default {
  input: "src/index.ts",
  output: {
    dir: "dist",
    format: "esm",
  },
  plugins: [ttsc()],
};
```

### esbuild

```ts
// esbuild.config.ts
import { build } from "esbuild";
import ttsc from "@ttsc/unplugin/esbuild";

await build({
  entryPoints: ["src/index.ts"],
  outdir: "dist",
  bundle: true,
  plugins: [ttsc()],
});
```

### Webpack

```js
// webpack.config.mjs
import ttsc from "@ttsc/unplugin/webpack";

export default {
  entry: "./src/index.ts",
  output: {
    path: new URL("./dist", import.meta.url).pathname,
  },
  plugins: [ttsc()],
};
```

### Rspack

```js
// rspack.config.mjs
import ttsc from "@ttsc/unplugin/rspack";

export default {
  entry: "./src/index.ts",
  plugins: [ttsc()],
};
```

### Next.js

```js
// next.config.mjs
import withTtsc from "@ttsc/unplugin/next";

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};
export default withTtsc(nextConfig);
```

### Farm

```ts
// farm.config.ts
import ttsc from "@ttsc/unplugin/farm";
import { defineConfig } from "@farmfe/core";

export default defineConfig({
  plugins: [ttsc()],
});
```

### Bun

```ts
// build.ts
import ttsc from "@ttsc/unplugin/bun";

await Bun.build({
  entrypoints: ["src/index.ts"],
  outdir: "dist",
  plugins: [ttsc()],
});
```

## Configuration

By default, `@ttsc/unplugin` finds the nearest `tsconfig.json` from the file being transformed and uses that project's plugin settings, including directly installed plugin packages.

If that is already the config you want, `ttsc()` is enough.

### Project Selection

Use `project` when the bundler should read a different config file:

```ts
import ttsc from "@ttsc/unplugin/vite";

export default {
  plugins: [
    ttsc({
      project: "tsconfig.bundle.json",
    }),
  ],
};
```

The project path is resolved from `process.cwd()`.

### Inline Compiler Options

Use `compilerOptions` when the bundler needs a small override without another config file:

```ts
import ttsc from "@ttsc/unplugin/vite";

export default {
  plugins: [
    ttsc({
      compilerOptions: {
        plugins: [
          {
            transform: "@ttsc/lint",
            rules: { noVar: "error" },
          },
          {
            transform: "typia/lib/transform",
            finite: true,
          },
        ],
      },
    }),
  ],
};
```

`compilerOptions` is layered on top of the selected project config. Existing settings stay in place, and only the fields you pass here are changed for the bundler build.

### Plugin Overrides

Use the top-level `plugins` option inside `ttsc(...)` when the bundler should use a different plugin list from `tsconfig.json`:

```ts
import ttsc from "@ttsc/unplugin/vite";

export default {
  plugins: [
    ttsc({
      plugins: [
        { transform: "@ttsc/lint", rules: { noVar: "error" } },
        { transform: "typia/lib/transform" },
      ],
    }),
  ],
};
```

Explicit adapter options override the plugin list read from the selected project config.

Set `plugins: false` to run the adapter without loading project plugins.

### Next.js Options

Pass adapter options as the second argument:

```js
// next.config.mjs
import withTtsc from "@ttsc/unplugin/next";

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withTtsc(nextConfig, {
  project: "tsconfig.bundle.json",
});
```

### Adapter Entrypoints

Import the entrypoint that matches your bundler:

```ts
import ttsc from "@ttsc/unplugin/vite";
```

Supported entrypoints are:

- `@ttsc/unplugin/vite`
- `@ttsc/unplugin/esbuild`
- `@ttsc/unplugin/rollup`
- `@ttsc/unplugin/rolldown`
- `@ttsc/unplugin/webpack`
- `@ttsc/unplugin/rspack`
- `@ttsc/unplugin/farm`
- `@ttsc/unplugin/next`
- `@ttsc/unplugin/bun`

Each entrypoint supports ESM import and CJS require. In CommonJS configs, read the default export from `require("@ttsc/unplugin/vite").default`.

### Options

```ts
import type { TtscUnpluginOptions } from "@ttsc/unplugin";

const options: TtscUnpluginOptions = {
  project: "tsconfig.json",
  compilerOptions: {
    baseUrl: ".",
  },
  plugins: false,
};
```

- `project`: path to the `tsconfig.json` used by the bundler.
- `compilerOptions`: temporary override layered on the selected project config.
- `plugins`: direct `ttsc` plugin list override, or `false` to disable plugins.

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `ttsc` development.

## References

Inspired by [`@ryoppippi/unplugin-typia`](https://github.com/ryoppippi/unplugin-typia).
