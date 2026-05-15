# Consumer Quickstart

Use this path when you want to run `ttsc` or `ttsx` in an existing TypeScript project.

## Install

```bash
npm install -D ttsc @typescript/native-preview
```

## Commands

Type-check or build with `ttsc`:

```bash
npx ttsc --noEmit
npx ttsc
npx ttsc --watch
```

Run a TypeScript entrypoint with `ttsx`:

```bash
npx ttsx src/index.ts
npx ttsx --project tsconfig.json src/index.ts -- --port 3000
```

`ttsx` type-checks before running the entrypoint. See [ttsx Runtime](./11-ttsx-runtime.md) for runner options.

## Add a Plugin

Install the plugin:

```bash
npm install -D @ttsc/lint
```

Add `lint.config.json` when the plugin requires one:

```json
{
  "no-var": "error",
  "prefer-const": "warning"
}
```

Run `--noEmit` to type-check and report lint findings. Run `ttsc fix` to rewrite source files in place using the built-in autofixers (see the [@ttsc/lint Fix section](https://github.com/samchon/ttsc/tree/master/packages/lint#fix) for the current list), then re-check:

```bash
npx ttsc --noEmit
npx ttsc fix
```

## Bundlers

Use `@ttsc/unplugin` when Vite, Rollup, esbuild, Webpack, Rspack, Next.js, Farm, or Bun owns the build:

```bash
npm install -D @ttsc/unplugin
```

```ts
// vite.config.ts
import ttsc from "@ttsc/unplugin/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [ttsc()],
});
```

See [`@ttsc/unplugin`](../packages/unplugin/) for adapter-specific setup.
