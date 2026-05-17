# `ttsc`

![banner of ttsc](https://raw.githubusercontent.com/samchon/ttsc/refs/heads/master/assets/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE)
[![NPM Version](https://img.shields.io/npm/v/ttsc.svg)](https://www.npmjs.com/package/ttsc)
[![NPM Downloads](https://img.shields.io/npm/dm/ttsc.svg)](https://www.npmjs.com/package/ttsc)
[![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest)
[![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs)
[![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

A TypeScript-Go toolchain.

`ttsc` replaces `tsc`. Pair it with `@ttsc/lint` and it also replaces `prettier` and `eslint` — type errors, lint violations, and format diffs all come out as `error TSxxxxx` in one compile run, blocking the same CI step.

## Quick start

```bash
npm install -D ttsc @ttsc/lint @typescript/native-preview
```

Register `@ttsc/lint` in your `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "plugins": [{ "transform": "@ttsc/lint" }]
  }
}
```

Same flags you already pass to `tsc`:

```bash
npx ttsc                 # type-check + lint + format diagnostics
npx ttsc fix             # autofix every fixable rule, then re-check
npx ttsx src/index.ts    # run TS with a real type-check
```

Full guides: [ttsc.dev](https://ttsc.dev/docs).

## What's in the box

| | What it does |
| -- | -- |
| **`ttsc`** | Compiler. Drop-in for `tsc` — build, check, watch, fix, format. |
| **`ttsx`** | Run a TS entrypoint after a real type-check. Drop-in for `tsx` / `ts-node`. |
| **`@ttsc/lint`** | 140+ lint and format rules. Diagnostics surface as TS compile errors. |
| **`@ttsc/unplugin`** | Same plugin pass inside Vite, Rollup, Rolldown, esbuild, Webpack, Rspack, Next.js, Farm, Bun. |
| **`@ttsc/wasm`** | The same compiler, in the browser. |
| **First-party plugins** | [`@ttsc/banner`](https://ttsc.dev/docs/plugins/banner), [`@ttsc/paths`](https://ttsc.dev/docs/plugins/paths), [`@ttsc/strip`](https://ttsc.dev/docs/plugins/strip). |
| **Ecosystem** | [`typia`](https://ttsc.dev/docs/plugins/typia) (runtime validators, JSON tools, LLM tooling) and [`nestia`](https://nestia.io) (NestJS routes, OpenAPI, SDK). |

Editor integration ships out of the box — install the VSCode extension and plugin diagnostics appear live.

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `ttsc` development.

## References

- TypeScript runners: [`ts-node`](https://github.com/TypeStrong/ts-node) and [`tsx`](https://github.com/privatenumber/tsx)
- Transformer tooling: [`ttypescript`](https://github.com/cevek/ttypescript) and [`ts-patch`](https://github.com/nonara/ts-patch)
- Inspired by: [`typical`](https://github.com/elliots/typical) and [`tsgonest`](https://github.com/tsgonest/tsgonest)
