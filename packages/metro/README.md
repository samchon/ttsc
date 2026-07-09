# `@ttsc/metro`

![banner of @ttsc/metro](https://ttsc.dev/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/@ttsc/metro.svg)](https://www.npmjs.com/package/@ttsc/metro) [![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/metro.svg)](https://www.npmjs.com/package/@ttsc/metro) [![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest) [![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

Metro (React Native / Expo) adapter for `ttsc` plugins.

React Native and Expo bundle with **Metro**, which transpiles each file with Babel (`babel-preset-expo` / `@react-native/metro-babel-transformer`). Babel strips TypeScript types and never runs TypeScript transformers, so neither the `ttsc` CLI nor `@ttsc/unplugin` can reach an RN/Expo build. `@ttsc/metro` wires a Metro custom transformer that runs the `ttsc` plugin pass (typia, nestia, …) on each TypeScript file, then hands the result to your existing Expo/React-Native Babel transformer.

## Setup

Install `ttsc` and TypeScript-Go first. Then install the Metro adapter:

```bash
npm install -D ttsc typescript
npm install -D @ttsc/metro
```

Wrap your Metro config with `withTtsc`.

### Expo

```js
// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withTtsc } = require("@ttsc/metro");

module.exports = withTtsc(getDefaultConfig(__dirname));
```

### Bare React Native

```js
// metro.config.js
const { getDefaultConfig } = require("@react-native/metro-config");
const { withTtsc } = require("@ttsc/metro");

module.exports = withTtsc(getDefaultConfig(__dirname));
```

`withTtsc` sets `transformer.babelTransformerPath` and leaves the rest of your config untouched. It auto-detects the upstream transformer to delegate to (`@expo/metro-config/babel-transformer` for Expo, then `@react-native/metro-babel-transformer`, then the legacy `metro-react-native-babel-transformer`).

## Configuration

By default `@ttsc/metro` finds the nearest `tsconfig.json` from the file being transformed and runs the plugins configured there: the standard `ttsc` model. If that is the config you want, `withTtsc(getDefaultConfig(__dirname))` is enough.

Options are the second argument and mirror `@ttsc/unplugin`, plus a few Metro-specific knobs:

```js
module.exports = withTtsc(getDefaultConfig(__dirname), {
  project: "tsconfig.build.json",
  plugins: [{ transform: "typia/lib/transform" }],
  exclude: ["__tests__"],
});
```

- `project`: path to the `tsconfig.json` the transformer should read (resolved from `process.cwd()`).
- `compilerOptions`: a temporary overlay layered on the selected project config.
- `plugins`: an explicit `ttsc` plugin list override, or `false` to disable project plugins.
- `upstreamTransformer`: an explicit module path for the Babel transformer to delegate to, when auto-detection is not what you want.
- `include` / `exclude`: substring patterns matched against the project-relative file path, selecting which files run through the `ttsc` pass (`.ts`/`.tsx`/`.cts`/`.mts` only; declaration and JavaScript files always pass straight through).

Options are forwarded from the Metro **config** process to Metro's **worker** processes through the `TTSC_METRO_OPTIONS` environment variable, so they must stay JSON-serialisable (hence substring patterns rather than `RegExp`).

## How it works

For each TypeScript file Metro asks to transform:

1. `@ttsc/metro` runs the `ttsc` plugin pass (reusing `@ttsc/unplugin`'s transform core) → transformed **TypeScript** source.
2. The transformed source is handed to the upstream Expo/React-Native Babel transformer, which strips types, applies the RN transforms, and returns the Babel AST Metro consumes.

The plugin contract, `tsconfig` discovery, and per-build cache are identical to every other `ttsc` bundler integration.

## Caveats (v1)

- **Cost model.** This release reuses `@ttsc/unplugin`'s transform core, which type-checks the whole `tsconfig` project and caches the result per process. Metro runs transforms in a multi-process worker pool, so the project is compiled once per worker (on that worker's first file). A resident, incremental, per-file compiler shared across workers is the planned optimization, tracked in [samchon/ttsc#255](https://github.com/samchon/ttsc/issues/255).
- **Cache invalidation.** Metro keys its transform cache on per-file content plus a static transformer key. A `ttsc` transform can depend on a _type_ in another file; editing that type does not change the dependent file's content, so Metro may serve a stale transform. After changing `tsconfig`/plugin configuration or a depended-upon type, restart Metro with `--reset-cache`.
- **Type errors fail the build.** The `ttsc` pass type-checks; a project type error surfaces as a Metro build error, matching the other `ttsc` bundler integrations.

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `ttsc` development.

## References

Inspired by [`@elliots/metro-transformer-typical`](https://github.com/elliots/typical/tree/main/packages/metro-transformer).
