# `@ttsc/evidence`

![banner of @ttsc/evidence](https://ttsc.dev/og-evidence.png)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/@ttsc/evidence.svg)](https://www.npmjs.com/package/@ttsc/evidence) [![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/evidence.svg)](https://www.npmjs.com/package/@ttsc/evidence) [![Build Status](https://github.com/samchon/ttsc/actions/workflows/build.yml/badge.svg)](https://github.com/samchon/ttsc/actions/workflows/build.yml) [![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs/evidence) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

Evidence Graph, your spec as a compile error no coding agent can skip.

```typescript
 * @evidence docs/discount.md#coupon-stacking States the per-issuer stacking limit
 *                                            this section defines, in the buyer's words.
 * @evidence POST:/orders/{orderId}/coupons Explains the rejection this endpoint returns
 *                                          for an over-stacked coupon set.
 */
export function CouponStackingNotice(props: IProps): JSX.Element;
```

`@evidence <target> <reason>` names one unit of the spec and says why this declaration answers for it. A target is a document section, a schema model, an API operation, or a TypeScript symbol written as `{@link hooks.useCouponStacking}`.

```text
$ npx ttsc
error TS16411: [evidence/graph] Missing acknowledgement for 'useCouponStacking'
  (TypeScript function 'useCouponStacking' at src/lib/coupons/hooks.ts:12)
  in Claim 1 reference 3 (typescript, symbols: function).

  Use @evidence on a selected typescript host or @evidenceExclude on an eligible carrier.

Found 1 error.
```

Two citations were not enough. This screen also owes the hook it renders, and the build names the obligation it skipped rather than the two it met.

![Coverage and token spend across all four subjects](https://ttsc.dev/benchmark/png/evidence-summary.png)

So a coding agent ships at 100% coverage every time, instead of wherever its own review loop happened to stop.

## Setup

```bash
npm install -D typescript ttsc @ttsc/lint @ttsc/evidence
```

```ts
// lint.config.ts
import { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      type: "typescript",
      files: ["src/components/**/*.tsx"],
      symbol: "function",
      reference: {
        type: "markdown",
        files: ["docs/**/*.md"],
        symbol: ["h2", "h3"],
      },
    },
  ],
};

export default {
  plugins: { evidence },
  rules: { "evidence/graph": ["error", graph] },
} satisfies ITtscLintConfig;
```

One sentence: the components under `src` implement the docs, so every H2 and H3 under `docs` must be cited by a component. Violations arrive in the same stream as type errors, so there is no CI job to add.

This is a rule contributor to [`@ttsc/lint`](https://github.com/samchon/ttsc/tree/master/packages/lint) 0.22 or newer, so it runs on [`ttsc`](https://github.com/samchon/ttsc) rather than on stock `tsc` with ESLint.

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `@ttsc/evidence` development.

## References

- [`ttsc`](https://github.com/samchon/ttsc): the TypeScript-Go toolchain this plugin runs on.
- [`@ttsc/lint`](https://github.com/samchon/ttsc/tree/master/packages/lint): the lint engine that links this rule into the compiler.
- [Evidence Graph guide](https://ttsc.dev/docs/evidence): claims, symbol selectors, populations above the project, and staged adoption.
- [Evidence Graph benchmark](https://ttsc.dev/docs/benchmark/evidence): the cohort above, and how to run it.
- [`benchmarks/evidence/template`](https://github.com/samchon/ttsc/tree/master/benchmarks/evidence/template): a full wiring across a Prisma schema, a NestJS API, a generated SDK, tests, screens, and E2E journeys.
- Adopting it on a team? Reach me on [Discord](https://discord.gg/E94XhzrUCZ).
