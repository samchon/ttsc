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

`withTtsc` covers both of Next.js's bundlers. It injects the webpack plugin and wires the Turbopack loader rules, with the options you pass reaching both, so the same config works whether Next runs on Turbopack (the default in current majors) or on webpack. Your own `webpack` hook and `turbopack` block are preserved: unrelated rules and settings survive, and a rule you already wired for this loader by hand is left alone rather than registered twice.

That last part is decided by exact spelling. `withTtsc` declines to add its own rule when your glob is one it has measured against a real Turbopack build as naming every file with the extension: `*.ext`, `**/*.ext`, and `{**/,}*.ext` for each of `ts`, `tsx`, `mts`, and `cts`; plus the `*.{...}`, `{*.ext,...}`, `**/*.{...}`, `**/{*.ext,...}`, and `**/**/*.{...}` forms for every canonical combination of two or more extensions chosen from that same list. Any other spelling keeps your rule and gains ours beside it, so a module may be transformed twice rather than not at all. The list is exact on purpose: treating an unmeasured glob as project-wide once left every module in a project with no `ttsc` rule at all, and a build that transforms twice is recoverable in a way a build that never transforms is not.

### Turbopack

Turbopack has no JS plugin API, but it runs webpack loaders through `turbopack.rules`, and a ttsc transform is exactly loader-shaped (TypeScript source in, transformed source out). `@ttsc/unplugin/turbopack` is that standalone loader. In a Next.js project `withTtsc` wires it for you; wire it directly when Turbopack runs outside Next, or when you want the rules under your own control:

```js
// next.config.mjs
/** @type {import("next").NextConfig} */
const nextConfig = {
  turbopack: {
    rules: {
      "*.ts": { loaders: ["@ttsc/unplugin/turbopack"] },
      "*.tsx": { loaders: ["@ttsc/unplugin/turbopack"] },
      "*.mts": { loaders: ["@ttsc/unplugin/turbopack"] },
      "*.cts": { loaders: ["@ttsc/unplugin/turbopack"] },
    },
  },
};
export default nextConfig;
```

Pass options through the rule's `options` object: `{ loader: "@ttsc/unplugin/turbopack", options: { project: "tsconfig.build.json" } }`. The loader keeps a per-worker compiler cache (Turbopack runs loaders in a worker pool) and returns the source unchanged for everything the adapters' shared filter excludes (declaration files, `node_modules` paths, non-TypeScript sources, and virtual ids) and for transforms that produce no change.

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

For `bun run` and `bun test`, where there is no bundling step, register the same transform on Bun's module loader through `@ttsc/unplugin/bun-register`. Preload it once in `bunfig.toml`:

```toml
preload = ["@ttsc/unplugin/bun-register"]
```

Or register it imperatively, optionally with options:

```ts
import register from "@ttsc/unplugin/bun-register";

register({ project: "tsconfig.build.json" });
```

Importing the module registers it, so a bare `import "@ttsc/unplugin/bun-register"` is enough when the defaults are right. CommonJS and ESM loads in the same Bun process share that one registration. Calls made before the first transformable TypeScript load use last-call-wins and capture their options by value, which lets an immediate explicit call replace the preload defaults without installing a second loader. Entering the first such load locks the options synchronously for the module-loading session. A later call with the same structural value is idempotent, while a different value throws and requires restarting the Bun process.

Under `Bun.build`, the adapter yields to the next loader for declarations, `node_modules`, source that `ttsc` leaves unchanged, and entries supplied through `Bun.build({ files })`. In-memory entries remain with Bun because ttsc transforms filesystem-backed project inputs. Bun's runtime `onLoad` contract does not accept an undefined result, so `Bun.plugin()` explicitly passes excluded and unchanged filesystem files through with their original source. Each `Bun.build` opens a delivery pass through `onStart`, then `onEnd` disposes the completed project generation and its filesystem trackers. The runtime API has neither lifecycle hook, so one setup is treated as one immutable module-loading session: restart the Bun process after changing source, tsconfig, or plugin inputs.

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
- `@ttsc/unplugin/bun-register`
- `@ttsc/unplugin/api`

Each entrypoint supports ESM import and CJS require. In CommonJS configs, read the default export from `require("@ttsc/unplugin/vite").default`. `@ttsc/unplugin/turbopack` is not an unplugin factory but a standalone webpack loader; reference it by module name inside `turbopack.rules` instead of calling it.

`@ttsc/unplugin/bun-register` is the Bun **runtime** entry rather than a bundler adapter, covered under [Bun](#bun) above. `@ttsc/unplugin/api` exposes the transform core itself (`transformTtsc`, `resolveOptions`, the cache lifecycle) for hosts that are not unplugin-shaped; `@ttsc/metro` is built on it.

That entry point also exposes the project-membership rule (`readProjectMembershipPolicy`, `mergeMembershipPolicyOverlay`, `ITtscProjectMembershipPolicy`, `isProjectWalkPath`, and the input-hash collectors), which decides which files can enter the compiled program and therefore which changes invalidate a cached compile. These exist so a host that keeps its own cache asks that question exactly the way the transform core asks it: `@ttsc/metro` folds them into Metro's static transformer key, and the two halves disagreeing about one project is the bug class they exist to prevent. They are shaped for that use rather than as a general-purpose configuration reader, and they move with the core rather than under a stability guarantee of their own. Build a host on them if you need it; pin your `@ttsc/unplugin` version if you do.

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

#### Path Aliases

Under Vite, the adapter reads the resolved `resolve.alias` and layers it onto the generated config, so an alias declared only in `vite.config.ts` still resolves during the compile. No other host's alias configuration is read: under Rollup, Rolldown, webpack, Rspack, esbuild, Farm, Turbopack and Bun, the compile resolves through the tsconfig's own `paths` alone. Declare an alias in `paths` when a module has to resolve for the compiler as well as for the bundler, which is what those hosts need anyway for `tsc` to type-check the same imports.

Not every Vite alias form can be forwarded, because a tsconfig `paths` map cannot express all of them:

| `resolve.alias` form | Forwarded |
| --- | --- |
| `{ "@": "/src" }`, or the array form with a string `find` | yes |
| array form with a `RegExp` `find`, such as `{ find: /^~/ }` | no: `paths` has no regular-expression form |
| a string `find` containing `*` | no: a `paths` key already reads `*` as its own wildcard |

In both unforwarded cases the compile resolves that specifier through the tsconfig's `paths` alone, so declare it there if `ttsc` must resolve through it. A prefix `RegExp` such as `/^~/` is written as a `"~/*"` entry. Reducing simple prefix patterns automatically is deliberately not attempted: distinguishing `/^~/` from `/^@app/`, which also matches `@apple`, needs enough of a regular-expression engine that a wrong reduction becomes likely, and a mistranslated alias resolves imports to the wrong file without saying so.

A `find` containing `*` is also reported once on stderr, naming the alias and the reason. A `RegExp` `find` is not, and the asymmetry is deliberate: Vite merges two `RegExp` aliases of its own into every resolved config, for `@vite/env` and `@vite/client`, so a report on that form would fire in every build of every project and name aliases you never wrote.

### Cache and Watch Invalidation

Editing a type that only a generated validator depends on invalidates the module, in watch mode, in webpack's filesystem cache and in Turbopack's `fileDependencies`, even though the bundler erased the type-only import from its own graph. The adapter registers each transformed file's reference closure, the global-scope files, the configs, the importer resolution inputs and the universal automatic-type inputs with the bundler, plus whatever the plugins themselves report. The [setup guide](https://ttsc.dev/docs/setup/unplugin) describes how that set is derived and proven.

One whole-project compile already contains every module's output, so the adapter compiles the project once and serves every module from that one result. Everything below is about when it may keep doing that.

#### When the generation is reused

A host with a build boundary opens a delivery pass there. The pass's first delivery proves the whole generation against the current filesystem once, and after that each module's first delivery in the pass is settled by the supplied source alone. `buildStart` repeats per rebuild under webpack, Rspack, Rollup, Rolldown, esbuild and `vite build --watch`, so a pass boundary means "each module is requested at most once from here", not "the compiled program is stale".

Hosts with no build boundary (Metro workers, the Turbopack loader, and a watching Vite dev server, whose one `buildStart` spans later HMR edits) validate each generation hit against the inputs that can affect the module being asked for: its reference closure, the global-scope files, the configs, importer resolution inputs, universal automatic-type inputs, and plugin dependencies. Sibling modules share one proof of the closure rather than repeating it per module.

Project membership comes from the resolved configuration rather than from a list of directory names. `allowJs` and `resolveJsonModule` decide which file extensions can enter the program, so a bundle emitted beside your sources is not a membership change for a project that compiles no JavaScript. When no top-level `exclude` is declared, TypeScript uses `outDir` and `declarationDir` as implicit directory exclusions; an explicit `exclude`, including an empty array, replaces those defaults with its own entries. An adapter's `compilerOptions` replace or clear inherited `outDir` and `declarationDir` values before membership is derived, and `${configDir}` paths follow TypeScript's config-relative substitution. Everywhere else, a directory takes part in membership only while it can hold a program input, so an output directory no configuration names still costs nothing as long as what it holds is not admissible, and the first source appearing in it is detected because the directory is walked and watched throughout. A project that does admit JavaScript should name its bundler's output directory in `exclude`, since otherwise an emitted `.js` there is a program input like any other. Emptying and recreating a directory the effective exclusions name, which `emptyOutDir` and `output.clean` do on every build, costs nothing either.

#### When it is discarded

An input change or an explicit cache lifecycle reset permits a new generation. Opening a pass is not such a reset.

Closing a webpack or Rspack compiler disposes its generation at the compiler's shutdown hook. esbuild disposes after a one-shot build or after the last overlapping build context closes; an older delayed disposal cannot clear a replacement build that has already reached `onStart`. These terminal boundaries release generation-owned filesystem trackers without discarding the generation on each rebuild.

A compile that failed outright is retained for the rest of that pass, so its remaining modules replay the verdict instead of repeating an identical failing compile once per module, and the next pass attempts it again. A host with no pass boundary keeps evicting a failed compile on every delivery, so a transient toolchain failure never becomes permanent for a long-lived worker.

#### What this changes for you

A module the compiled program does not contain is left untransformed and reported once per pass, naming the file and the tsconfig it is missing from. This is not a build error: the file is simply not this project's to transform, and the usual cause is a bundle graph that reaches further than the tsconfig's `include`. Add it there if ttsc plugins should apply to it.

A file whose transform no plugin can contribute to is validated against the universal inputs and itself rather than its whole reference closure. Its diagnostics narrow with it, so a type error introduced in such a file surfaces at the next compile the build runs for another reason rather than at the edit. Run the compiler's own check beside the bundler when you want type errors at the edit.

A Bun runtime plugin registration is one process-scoped module-loading session, so restart the Bun process after changing source, tsconfig, or plugin inputs.

A dev server started without a watcher (`server.watch: null`, which is what `vitest --run` configures) takes the pass lifecycle instead of per-delivery validation. Nothing can deliver a change event to such a session, so per-delivery validation there buys incoherence rather than freshness: modules delivered before an edit and after it would come from two different compilations of one program.

Freshness proofs rest on filesystem observations, so two environments need care. A project on a network mount that accepts a watch and then reports nothing should be treated as one where notifications do not work. For metadata reuse, the adapter rewrites its own retained probe before validation and accepts only older stamps on the same reporting device. A clock rollback cannot strand historical proof because the previous reference is discarded before that write, and an unavailable or cross-volume probe keeps the byte comparison instead. A constant offset from the process clock is irrelevant because the process clock is never compared.

The [setup guide](https://ttsc.dev/docs/setup/unplugin) describes how these proofs are built.

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `ttsc` development.

## References

Inspired by [`@ryoppippi/unplugin-typia`](https://github.com/ryoppippi/unplugin-typia).
