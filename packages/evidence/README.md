# `@ttsc/evidence`

![banner of @ttsc/evidence](https://ttsc.dev/og-evidence.png)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/@ttsc/evidence.svg)](https://www.npmjs.com/package/@ttsc/evidence) [![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/evidence.svg)](https://www.npmjs.com/package/@ttsc/evidence) [![Build Status](https://github.com/samchon/ttsc/actions/workflows/build.yml/badge.svg)](https://github.com/samchon/ttsc/actions/workflows/build.yml) [![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs/evidence) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

A coding agent can claim it followed every requirement while silently skipping some. Finding those omissions means rereading the specification, implementation, and tests until another review round finds nothing new.

Evidence Graph replaces that loop with compile-time obligations. You declare which artifacts owe which specification units. The agent cites each unit from the code, test, schema, or document that satisfies it and states why. An unanswered unit is a compile error.

Evidence Graph can also require the agent to state how each function follows project-wide principles. "No hard coding" and "Fix root causes" then become explicit obligations on every selected function.

```tsx
/**
 * @evidence docs/discount.md#coupon-stacking States the per-issuer stacking limit this section defines, in the buyer's words.
 * @evidence POST:/orders/{orderId}/coupons Explains the rejection this endpoint returns for an over-stacked coupon set.
 * @evidence {@link hooks.useCouponStacking} Renders the limit this hook resolves.
 * @evidence docs/principles.md#no-hard-coding Renders limits from props instead of branching on known issuer names.
 * @evidenceExclude docs/principles.md#fix-root-causes-not-symptoms No failure to fix.
 */
export function CouponStackingNotice(props: IProps): JSX.Element;
```

`@evidence <target> <reason>` is the agent's explicit claim about what this code implements and why. `@evidenceExclude` records why an obligation does not apply.

A target is one of four kinds:

- **Markdown**: a file, or a section of one.
- **Prisma**: a model, a column, or a relation.
- **Swagger**: an operation, method and path together.
- **TypeScript**: a type, a function, or a property, written as an inline link.

Leave one obligation unanswered and the build stops.

```bash
$ npx ttsc
error TS16411: [evidence/graph] Missing acknowledgement for 'docs/discount.md#coupon-stacking'
  (Markdown H2 'Coupon Stacking' at docs/discount.md:3)
  in Claim 1 reference 1 (markdown, symbols: h2, h3).

...

Found 3 errors.
```

Missing obligations appear in the same build as type errors. The error list is the agent's task list.

## Benchmark

![Coverage and token spend across all four subjects](https://raw.githubusercontent.com/samchon/ttsc/gh-pages/benchmark/png/evidence-summary.png)

One agent built each subject twice. Same inputs, same engine, same model; only this plugin differs.

- **Plain**: omissions are invisible, so review hunts them.
  - Read everything, fix every finding, restart until a round finds nothing.
  - The loop until dry eats 90–95% of all tokens.
  - Coverage still lands at 51.6–85.5%, falling as the subject grows.
- **Evidence**: omissions are compile errors, so review reads the tag list.
  - One pass, judging whether each reason is true.
  - Review takes 15–41% of the tokens.
  - Coverage lands at 100% on every subject.

[The benchmark guide](https://ttsc.dev/docs/benchmark/evidence) breaks each run down by phase, and [`samchon/evidence-benchmark-results`](https://github.com/samchon/evidence-benchmark-results) keeps the raw sessions.

## Setup

### Install

```bash
npm install -D typescript ttsc @ttsc/lint
npm install -D @ttsc/evidence
```

This is a rule contributor to [`@ttsc/lint`](https://github.com/samchon/ttsc/tree/master/packages/lint), so it runs on [`ttsc`](https://github.com/samchon/ttsc) rather than on stock `tsc` with ESLint.

### Configure

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
  rules: {
    "evidence/graph": ["error", graph],
    "evidence/review": "error",
  },
} satisfies ITtscLintConfig;
```

One claim: the components under `src` implement the docs, so every H2 and H3 under `docs` must be cited by a component. Run `npx ttsc` and the error count is the backlog.

[The rule reference](https://ttsc.dev/docs/evidence/rules) has four more rules beside `evidence/graph`, and [the claim reference](https://ttsc.dev/docs/evidence/claims) has every claim option.

### Tags

The configuration is written once. The tags are written forever: `@evidence` cites, `@evidenceReview` verifies, and `@evidenceExclude` declines. [The tag reference](https://ttsc.dev/docs/evidence/tags) has the full grammar.

A false tag removes the error, not the problem. `@evidenceReview` resolves it:

```ts
/**
 * @evidence docs/discount.md#coupon-stacking States the per-issuer limit.
 * @evidenceReview docs/discount.md#coupon-stacking #a1b2c3d4e5f6
 *                 Verified against policy section 3.
 */
```

- Reviews match the same declaration and target.
- The fingerprint expires when the cited content changes.

The compiler handles omissions. Humans handle falsehoods.

## Spec-Driven Development

Requirements are the handoff: whether a human or an AI wrote them, a human must review them last. That reviewed layer is the source of truth, the evidence the AI builds everything else from.

Each arrow is one claim from `lint.config.ts`, pointing at the evidence it cites.

<picture><source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/documents-dark.svg"><img alt="Idea notes grounding Requirements and Specifications, which ground Implementation and Test" src="https://ttsc.dev/evidence/documents-light.svg" width="100%"></picture>

- Hand over the requirements, and the agent writes the rest.
- Hand over raw idea notes, and it writes the requirements too.

The compiler checks everything below: a dropped idea or a skipped requirement is a compile error, so nothing vanishes on the way down.

Even requirements cite their evidence, in comments, so the rendered document stays clean.

Backend, frontend, and even novels below are this same shape, drawn in detail.

### Start with principles

Spec-Driven Development does not require a complete document hierarchy. `docs/principles.md` can be only headings:

```md
## No hard coding
## No monkey patching
## Use the conventional solution
## Fix root causes, not symptoms
```

Make them a checklist:

```ts
{
  name: "every function answers every engineering principle",
  type: "typescript",
  files: ["src/**/*.ts"],
  symbol: "function",
  reference: {
    type: "markdown",
    files: ["docs/principles.md"],
    symbol: "h2",
    checklist: true,
    requireReview: true,
  },
}
```

`checklist` changes the denominator from principles to functions times principles. Every selected function must answer every principle, as `CouponStackingNotice` does above.

One missing answer fails the build. Adding a principle creates a new obligation on every selected function, and `requireReview` expires every affected review when that principle changes.

### Backend

<picture><source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/backend-dark.svg"><img alt="Requirements and Specifications grounding DB schema, API operation, API schema and Test" src="https://ttsc.dev/evidence/backend-light.svg" width="100%"></picture>

> Real config: [`api/lint.config.ts`](https://github.com/samchon/ttsc/blob/master/benchmarks/evidence/template/evidence/packages/api/lint.config.ts) and [`backend/test/lint.config.ts`](https://github.com/samchon/ttsc/blob/master/benchmarks/evidence/template/evidence/packages/backend/test/lint.config.ts)

The DB schema is Prisma, the rest is TypeScript, and one graph spans both:

- The DB schema cites the documents; no table without a documented reason.
- Operations and API schemas cite the DB layer and the documents behind it.
- Tests cite the operations; an untested operation is an open obligation.

### Frontend

<picture><source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/frontend-dark.svg"><img alt="Requirements and Specifications grounding Swagger, Hooks, Screens and Journeys" src="https://ttsc.dev/evidence/frontend-light.svg" width="100%"></picture>

> Real config: [`frontend/lint.config.ts`](https://github.com/samchon/ttsc/blob/master/benchmarks/evidence/template/evidence/packages/frontend/lint.config.ts)

The source layer is the backend's own Swagger output: a graph can start from what another project publishes.

- Hooks cite the operations they call.
- Screens cite the hooks they render.
- Journeys cite the screens they walk through.

Screens and journeys also cite the documents, so every screen traces back to a requirement.

### Novels

<picture><source media="(prefers-color-scheme: dark)" srcset="https://ttsc.dev/evidence/novel-dark.svg"><img alt="Principles and Settings grounding Storylines, Scenarios and Manuscripts" src="https://ttsc.dev/evidence/novel-light.svg" width="100%"></picture>

> Real config: [`napoleon-imperator/lint.config.ts`](https://github.com/samchon/novels/blob/master/packages/napoleon-imperator/lint.config.ts)

The graph reads no meaning, only obligations and citations, so it works on any text. Humans review only the settings (characters, world rules, history), and the novel follows. The principles are universal literary fundamentals, not something written per work.

- Every layer cites the principles for its literary purpose.
- Every layer cites the settings for facts, rules, and knowledge.
- Scenarios and manuscripts cite storylines for cause and consequence.
- A manuscript cites the scenario it executes, exactly.

Editing a setting expires every review on it, so a revision leaves no stale scene behind. [`samchon/novels`](https://github.com/samchon/novels) runs this graph on 25 principles, 350 setting commitments, and 742 scenes.

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `@ttsc/evidence` development.

## References

- [`ttsc`](https://github.com/samchon/ttsc): the TypeScript-Go toolchain this plugin runs on.
- [`@ttsc/lint`](https://github.com/samchon/ttsc/tree/master/packages/lint): the lint engine that links this rule into the compiler.
- [Guide Documents](https://ttsc.dev/docs/evidence)
- [Benchmark Diagram](https://ttsc.dev/docs/benchmark/evidence)
- [`samchon/evidence-benchmark-results`](https://github.com/samchon/evidence-benchmark-results)
