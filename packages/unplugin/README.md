# `@ttsc/unplugin`

![banner of @ttsc/unplugin](https://ttsc.dev/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/@ttsc/unplugin.svg)](https://www.npmjs.com/package/@ttsc/unplugin) [![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/unplugin.svg)](https://www.npmjs.com/package/@ttsc/unplugin) [![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest) [![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

Bundler adapter for `ttsc` plugins.

Use it when Vite, Rollup, esbuild, Webpack, Rspack, Next.js, Farm, or Bun owns the build but the project still needs `ttsc` plugins.

## Setup

Install `ttsc` and TypeScript-Go first. Then install the bundler adapter:

```bash
npm install -D ttsc typescript
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

`withTtsc` covers Next.js builds that go through webpack. When Next.js runs on Turbopack (`next dev --turbopack`), wire the Turbopack loader rules below instead.

### Turbopack

Turbopack has no JS plugin API, but it runs webpack loaders through `turbopack.rules`, and a ttsc transform is exactly loader-shaped (TypeScript source in, transformed source out). `@ttsc/unplugin/turbopack` is that standalone loader:

```js
// next.config.mjs
/** @type {import("next").NextConfig} */
const nextConfig = {
  turbopack: {
    rules: {
      "*.ts": { loaders: ["@ttsc/unplugin/turbopack"] },
      "*.tsx": { loaders: ["@ttsc/unplugin/turbopack"] },
    },
  },
};
export default nextConfig;
```

Pass options through the rule's `options` object: `{ loader: "@ttsc/unplugin/turbopack", options: { project: "tsconfig.build.json" } }`. The loader keeps a per-worker compiler cache (Turbopack runs loaders in a worker pool) and returns the source unchanged for declaration files, `node_modules` paths, and transforms that produce no change.

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

Under `Bun.build`, the adapter yields to the next loader for declarations, `node_modules`, source that `ttsc` leaves unchanged, and entries supplied through `Bun.build({ files })`. In-memory entries remain with Bun because ttsc transforms filesystem-backed project inputs. Bun's runtime `onLoad` contract does not accept an undefined result, so `Bun.plugin()` explicitly passes excluded and unchanged filesystem files through with their original source. `Bun.build` clears the project generation through its `onStart` lifecycle on every build. The runtime API has no corresponding hook, so one setup is treated as one immutable module-loading session: restart the Bun process after changing source, tsconfig, or plugin inputs.

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
            configFile: "./lint.config.ts",
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

Plugin-owned keys (typia's `finite` here) are forwarded to the plugin verbatim. `@ttsc/lint` reads only `configFile` from its entry; rules live in the referenced `lint.config.*` file (or one discovered by upward walk from the tsconfig directory when `configFile` is absent).

### Plugin Overrides

Use the top-level `plugins` option inside `ttsc(...)` when the bundler should use a different plugin list from `tsconfig.json`:

```ts
import ttsc from "@ttsc/unplugin/vite";

export default {
  plugins: [
    ttsc({
      plugins: [
        { transform: "@ttsc/lint", configFile: "./lint.config.ts" },
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
- `@ttsc/unplugin/turbopack`
- `@ttsc/unplugin/farm`
- `@ttsc/unplugin/next`
- `@ttsc/unplugin/bun`

Each entrypoint supports ESM import and CJS require. In CommonJS configs, read the default export from `require("@ttsc/unplugin/vite").default`. `@ttsc/unplugin/turbopack` is not an unplugin factory but a standalone webpack loader; reference it by module name inside `turbopack.rules` instead of calling it.

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

### Cache and Watch Invalidation

The transform graph also records module-resolution candidates that would outrank a selected target, plus the selected lexical spelling when the compiler reports its physical symlink or junction target. The adapter registers candidates for importers in the transformed file's reachability closure, so creating or changing a higher-priority probe or retargeting the selected alias invalidates watch and persistent caches without an importer or tsconfig edit.

The transform host reports the program's reference graph (the transform envelope's `graph` section: per-file direct resolved references with type-only edges included, global-scope files, and the tsconfig `extends` chain — see the [plugin protocol](https://ttsc.dev/docs/development/concepts/protocol#transform)). Per transformed file, the adapter registers the graph's reachability closure, the globals, and the configs with the bundler via `addWatchFile`, so editing a type that only a generated validator depends on invalidates the module — in watch mode, in webpack's filesystem cache, and in Turbopack's `fileDependencies` — even though the bundler erased the type-only import from its own graph.

Transform plugins may additionally report, per file, the source files they consulted (the envelope's `dependencies` field); the adapter registers those as watch files too, union semantics. A plugin that declares such a list [complete](https://ttsc.dev/docs/development/concepts/protocol#dependency-completeness) for a file narrows the registration instead: only its own list plus the tsconfig chain, so files the transform never consulted stop invalidating it. The JavaScript host also reports the descriptor's loaded CommonJS graph, every package manifest inspected by auto-discovery, and plugin-declared `hostInputs`. First-party plugins use that last field for implicit config discovery and evaluated config dependencies. These remain universal without turning arbitrary project assets into configuration. Files a plugin declares `volatile` (output depending on non-file inputs such as environment or time) bypass the adapter's transform cache and are marked uncacheable where the bundler exposes that control.

The transform cache snapshots every regular file reached by the non-following project walk plus graph-reported inputs outside that walk (`node_modules` declarations, monorepo sibling sources, files reached through symlinks or Windows junctions, and out-of-root `extends` ancestry). One whole-project compile already contains every module's output. Adapters with a guaranteed build boundary clear the previous generation there, then check only the supplied source on each module's first delivery from a complete generation in that build. An incomplete generation never takes that shortcut. Later deliveries of a graph-bearing generation validate that file's reference closure, globals, configs, resolution candidates, plugin dependencies, and exact host inputs. Every input a generation has already proven carries the nanosecond metadata signature captured around the read that proved it, so a later delivery that finds the signature unchanged reuses that proof instead of re-reading the bytes; any signature change falls back to the full content comparison. A signature is recorded only for a read nothing raced, only for an input whose recorded state came from bytes that were read, since the metadata of a path nothing could read holds still while the bytes behind it appear, and only once the observed filesystem's own clock has provably left the tick that minted the input's modification stamp: a filesystem stamps writes once per clock tick, so a same-length rewrite landing inside the recorded stamp's tick leaves the signature unchanged, and until some stamp the same filesystem minted later separates that tick the content comparison keeps running, re-earning the signature the moment it can. The reference instant comes from the filesystem itself — the adapter stamps a probe in its own scratch directory, the way git separates racily-clean index entries with the index file's own timestamp, and every observed stamp raises the same per-device floor — never from the process clock, so a filesystem clock running behind the host changes nothing: both sides of the comparison are stamps of equal granularity minted by one clock. Sibling modules therefore share one proof of the closure and the globals rather than repeating it per module. Generation-scoped directory notifications detect new, removed, or renamed project inputs without repeating a directory-stat pass per module; Windows isolates those notifications so deletion of a watched temporary tree cannot crash the host. The project is snapshotted before and after compilation, while every graph member carries the compiler filesystem's content and physical-identity proof; only a complete generation that still matches both may authorize narrow reuse. This also rejects an in-project or external A→B→A change whose restored post-compile bytes would otherwise hide the transient state used by the compiler. `dependenciesComplete` narrows file inputs by the same contract as watch registration. Envelopes without a graph, and generations whose watchers could not be opened or have since failed, retain complete-snapshot validation: losing a notification is the absence of a membership proof rather than evidence of a change, so such a generation keeps validating against its own recorded state (the directory snapshot, the input hashes, and the universal descriptor inputs whose every rejection is evidence of a change rather than an inability to prove one) instead of being discarded. A reported membership event is evidence, and still replaces the generation. Only an unstable or incomplete generation is refused outright. Bun runtime setup defines one process-scoped loading session. Long-lived hosts without either boundary (Metro workers, the Turbopack loader, and Vite's development server, whose initial `buildStart` spans later HMR edits) apply the file-specific validation on every generation hit.

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `ttsc` development.

## References

Inspired by [`@ryoppippi/unplugin-typia`](https://github.com/ryoppippi/unplugin-typia).
