# `ttsc`

![banner of ttsc](https://ttsc.dev/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/ttsc.svg)](https://www.npmjs.com/package/ttsc) [![NPM Downloads](https://img.shields.io/npm/dm/ttsc.svg)](https://www.npmjs.com/package/ttsc) [![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest) [![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

A `typescript-go` toolchain for compiler-powered plugins and type-safe execution.

- **`ttsc`**: build, check, and transform.
- **`ttsx`**: execute TypeScript with type checking.
- [**`@ttsc/lint`**](https://github.com/samchon/ttsc/tree/master/packages/lint): lint violations as compiler errors.
- [**`@ttsc/evidence`**](https://github.com/samchon/ttsc/tree/master/packages/evidence): 100% requirement coverage, or the build fails.
- [**`@ttsc/graph`**](https://github.com/samchon/ttsc/tree/master/packages/graph): compiler knowledge graph that cuts agent tokens by 92%.
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

That covers the CLI. The integrations each have a short guide:

- [`@ttsc/unplugin`](https://ttsc.dev/docs/setup/unplugin): Vite, Rollup, Rolldown, esbuild, webpack, Rspack, Next.js, Turbopack, Farm, and Bun.
- [`@ttsc/metro`](https://ttsc.dev/docs/setup/metro): React Native and Expo.
- [`@ttsc/vscode`](https://ttsc.dev/docs/setup/vscode): live editor diagnostics.

## Lint

Lint and format inside the type-check you already run. 720+ rules across 21 families, plus a formatter that reproduces Prettier's output.

```ts
// src/index.ts
var x: number = 3;
let y: number = 4;
const z: string = 5;
```

```bash
$ npx ttsc --noEmit
src/index.ts:3:7 - error TS2322: Type 'number' is not assignable to type 'string'.

3 const z: string = 5;
        ~

src/index.ts:2:5 - error TS17397: [prefer-const] Use const instead of let.

2 let y: number = 4;
      ~~~~~~~~~~~~~

src/index.ts:1:1 - error TS11966: [no-var] Unexpected var, use let or const instead.

1 var x: number = 3;
  ~~~~~~~~~~~~~~~~~~

Found 3 errors in the same file, starting at: src/index.ts:3
```

Type errors and lint violations arrive in one stream, so the CI step that already runs `ttsc --noEmit` gates lint with no second job and no second parse. On vscode's 6,093 files the rules take 73 ms inside that check, where ESLint spends 66.7 s as its own command.

`npx ttsc fix` applies autofixes and formatting; `npx ttsc format` only formats. Rules and every `format` key are in the [Lint and Format guide](https://ttsc.dev/docs/lint).

## Evidence Graph

Your spec becomes a compile error, so requirement coverage is 100% or the build does not pass. An agent can still lie, but it cannot lie by omission.

```tsx
/**
 * @evidence docs/discount.md#coupon-stacking
 *           States the per-issuer stacking limit
 *           this section defines, in the buyer's words.
 * @evidence POST:/orders/{orderId}/coupons
 *           Explains the rejection this endpoint returns
 *           for an over-stacked coupon set.
 * @evidence {@link hooks.useCouponStacking} Renders the limit this hook resolves.
 */
export function CouponStackingNotice(props: IProps): JSX.Element;
```

`@evidence <target> <reason>` names one unit of the spec and why this declaration answers for it. A target is a document section, an API operation, a database schema model, or a TypeScript symbol as an inline link.

```bash
$ npx ttsc
error TS16411: [evidence/graph] Missing acknowledgement for 'docs/discount.md#coupon-stacking'
  (Markdown H2 'Coupon Stacking' at docs/discount.md:3)
  in Claim 1 reference 1 (markdown, symbols: h2, h3).

  Use @evidence on a selected typescript host or @evidenceExclude on an eligible carrier.

Found 3 errors.
```

Without those tags, the build fails once per obligation, because one reference never covers another. An AI coding agent has to clear them to finish, and clearing them means citing each target and writing down why its code answers for it.

![Coverage and token spend, Plain against Evidence](https://ttsc.dev/benchmark/png/evidence-summary.png)

## Compiler Knowledge Graph

Your coding agent answers from the compiler instead of grepping and re-reading files.

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

One typed MCP tool over a graph the type checker resolved: what calls what, what a change would touch, where to start reading. Answers carry names, signatures, edges, and spans, never file bodies, so a large repository cannot inflate the response.

Across 64 measured question and model pairs, the median answer costs 92% fewer tokens and 95% fewer tool calls than the same agent with no MCP. The design and the comparators are in [`@ttsc/graph`](https://github.com/samchon/ttsc/tree/master/packages/graph).

![Median tokens on the shared onboarding question, lower is better](https://ttsc.dev/benchmark/svg/graph-common-codex-gpt-5.6-sol.svg)

## Plugins

A plugin hooks the compile to add checks, transforms, or type-driven code generation, all driven by the types the checker has already resolved. It runs on every `ttsc` build and `ttsx` run, with no extra step.

[typia](https://typia.io) is the canonical one. Ask it for a validator of any type, and the transform writes the implementation at build time:

```ts
import typia from "typia";

export const isStringArray = typia.createIs<string[]>();
```

No schema, no decorator. The call compiles to a plain function:

```js
export const isStringArray = (() => {
  return (input) =>
    Array.isArray(input) && input.every((elem) => "string" === typeof elem);
})();
```

Utility plugins shipped in this repository:

- [`@ttsc/banner`](https://github.com/samchon/ttsc/tree/master/packages/banner): adds `@packageDocumentation` JSDoc banners.
- [`@ttsc/evidence`](https://github.com/samchon/ttsc/tree/master/packages/evidence): turns a requirement into a compile error until code, tests, or docs acknowledge it by name.
- [`@ttsc/graph`](https://github.com/samchon/ttsc/tree/master/packages/graph): MCP server exposing a checker-resolved code graph to coding agents.
- [`@ttsc/lint`](https://github.com/samchon/ttsc/tree/master/packages/lint): lints and formats TypeScript source.
- [`@ttsc/paths`](https://github.com/samchon/ttsc/tree/master/packages/paths): rewrites source path aliases so JS and declaration emit receive relative imports.
- [`@ttsc/strip`](https://github.com/samchon/ttsc/tree/master/packages/strip): removes configured calls and `debugger` statements.
- [`@ttsc/unplugin`](https://github.com/samchon/ttsc/tree/master/packages/unplugin): runs `ttsc` plugins inside bundlers supported by `unplugin`.
- [`@ttsc/metro`](https://github.com/samchon/ttsc/tree/master/packages/metro): runs `ttsc` plugins inside Metro for React Native and Expo.

Ecosystem plugins; PRs adding yours are welcome:

- [`nestia`](https://github.com/samchon/nestia): generates NestJS routes, OpenAPI, and SDKs.
- [`typia`](https://github.com/samchon/typia): generates validators, serializers, and type-driven runtime code.

To write your own, start from [Plugin Development](https://ttsc.dev/docs/development).

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `ttsc` development.

## References

- TypeScript runners: [`ts-node`](https://github.com/TypeStrong/ts-node) and [`tsx`](https://github.com/privatenumber/tsx)
- Transformer tooling: [`ttypescript`](https://github.com/cevek/ttypescript) and [`ts-patch`](https://github.com/nonara/ts-patch)
- Inspired by: [`typical`](https://github.com/elliots/typical), [`tsgonest`](https://github.com/tsgonest/tsgonest) and [`codegraph`](https://github.com/colbymchenry/codegraph).
