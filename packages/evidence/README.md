# `@ttsc/evidence`

![banner of @ttsc/evidence](https://ttsc.dev/og-evidence.png)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/@ttsc/evidence.svg)](https://www.npmjs.com/package/@ttsc/evidence) [![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/evidence.svg)](https://www.npmjs.com/package/@ttsc/evidence) [![Build Status](https://github.com/samchon/ttsc/actions/workflows/build.yml/badge.svg)](https://github.com/samchon/ttsc/actions/workflows/build.yml) [![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs/evidence) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

Evidence Graph, your spec as a compile error no coding agent can skip.

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

`@evidence(<role>) <target> <reason>` adds the relation this declaration claims, and a reference can require one.

```bash
$ npx ttsc
error TS16411: [evidence/graph] Missing acknowledgement for 'docs/discount.md#coupon-stacking'
  (Markdown H2 'Coupon Stacking' at docs/discount.md:3)
  in Claim 1 reference 1 (markdown, symbols: h2, h3).

  Use @evidence on a selected typescript host or @evidenceExclude on an eligible carrier.

error TS16411: [evidence/graph] Missing acknowledgement for 'POST:/orders/{orderId}/coupons'
  (Swagger operation 'POST /orders/{orderId}/coupons' at api/openapi.json)
  in Claim 1 reference 2 (swagger operations).

  Use @evidence on a selected typescript host or @evidenceExclude on an eligible carrier.

error TS16411: [evidence/graph] Missing acknowledgement for 'useCouponStacking'
  (TypeScript function 'useCouponStacking' at src/lib/coupons/hooks.ts:12)
  in Claim 1 reference 3 (typescript, symbols: function).

  Use @evidence on a selected typescript host or @evidenceExclude on an eligible carrier.

Found 3 errors.
```

Without those tags, the build fails once per obligation, because one reference never covers another.

An AI coding agent has to clear them to finish, and clearing them means citing each target and writing down why its code answers for it. Coverage reaches 100% on its own, as the residue of the errors it closed.

![Coverage and token spend across all four subjects](https://raw.githubusercontent.com/samchon/ttsc/gh-pages/benchmark/png/evidence-summary.png)

That cohort was run in [`samchon/lint-plugin-evidence`](https://github.com/samchon/lint-plugin-evidence), which this package is vendored from, at the two revisions its cells record.

## Setup

### Install

```bash
npm install -D typescript ttsc @ttsc/lint
npm install -D @ttsc/evidence
```

This is a rule contributor to [`@ttsc/lint`](https://github.com/samchon/ttsc/tree/master/packages/lint) 0.22 or newer, so it runs on [`ttsc`](https://github.com/samchon/ttsc) rather than on stock `tsc` with ESLint.

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
  rules: { "evidence/graph": ["error", graph] },
} satisfies ITtscLintConfig;
```

One sentence: the components under `src` implement the docs, so every H2 and H3 under `docs` must be cited by a component. Violations arrive in the same stream as type errors, so there is no CI job to add.

### Rules

| Rule | Takes | What it does |
| --- | --- | --- |
| `evidence/graph` | [`ITtscEvidenceGraphConfig`](https://github.com/samchon/ttsc/blob/master/packages/evidence/src/structures/ITtscEvidenceGraphConfig.ts) | The graph itself. Project-scoped, so its entry declares no `files`. |
| `evidence/documented` | nothing | Requires a JSDoc block on every selected export, since a block is the only place a citation can live. |
| `evidence/singular` | nothing | Keeps one public identity per file, named after the file. |
| `evidence/todo` | nothing | Fails on every remaining JSDoc `@todo`, with its own text. |

Each takes `"error"`, `"warning"`, or `"off"`.

## Claims and references

A claim is the population that owes a citation, a reference is what it owes, and every claim and reference pair is its own 100% obligation. Listing two references means both must be satisfied, and a citation toward one never counts toward the other. They all join the same `claims` array.

| Kind | Units | Claim | Reference | Cites in |
| --- | --- | --- | --- | --- |
| Markdown | file, H1 to H4 sections | yes | yes | an HTML comment |
| Prisma | model, column, relation | yes | yes | a `///` comment |
| TypeScript | types, functions, properties | yes | yes | JSDoc |
| Swagger / OpenAPI | each operation under `paths` | no | yes | nothing, it cannot host a tag |

Every population takes glob patterns in `files`, resolved against the `ttsc` project root. Add `root` to resolve against another directory instead, inside the project, above it, or absolute, which is how several packages in a monorepo share one requirements set and write the same citation.

### Documents

```ts
{
  type: "markdown",
  files: ["docs/requirements/**/*.md"],
  reference: {
    type: "markdown",
    files: ["docs/meetings/**/*.md"],
    symbol: ["h2", "h3"],
  },
}
```

Markdown grounds Markdown, so a decision taken in a meeting and never written into the requirements fails the build. Deleting a requirement breaks every document that leaned on it, which is what stops a ghost spec from outliving its own source.

```md
## Coupon Stacking {#coupon-stacking}

<!-- @evidence docs/meetings/2026-01-12.md#discount-policy Carries the limit agreed in that meeting. -->
```

A citation sits in an HTML comment, so rendered prose stays clean, and a heading declares its own anchor with the `{#id}` suffix. A section citation sits under its heading; a whole-file citation sits at the top.

### Database schema

```ts
{
  type: "prisma",
  files: ["prisma/schema/**/*.prisma"],
  symbol: "model",
  reference: {
    type: "markdown",
    files: ["docs/requirements/**/*.md"],
    symbol: "h2",
  },
}
```

Every model justifies itself against a requirement, so a table nobody asked for has nothing to cite. Reverse the pair to make a provider owe the model it reads.

```prisma
/// @evidence docs/requirements/pricing.md#discount-policy Discount columns exist for this policy.
model Sale {
  /// @evidence docs/requirements/pricing.md#coupon-stacking The stacking limit is stored here.
  coupon_limit Int
}
```

A model is addressed as `prisma:Sale` and a member as `prisma:Sale.price`, never through the file it sits in, so moving a model between files cannot break a citation. Every matched file is parsed as one schema.

### API operations

```ts
{
  type: "typescript",
  files: ["src/controllers/**/*.ts"],
  reference: {
    type: "swagger",
    file: "https://raw.githubusercontent.com/samchon/shopping/refs/heads/master/packages/api/swagger.json",
  },
}
```

Each operation under `paths` is one obligation, so an operation the spec adds and nobody implemented is a compile error on the next build. The singular `file` names one local path or one `http:` URL, never a glob; use a `reference` array for several documents.

An operation is cited as `POST:/orders`, one whitespace-free token, so the method and the path stay one target. Swagger grounds a claim and never makes one, because an operation has nowhere to host a tag.

### Symbols

```ts
{
  type: "typescript",
  files: ["src/lib/*/hooks.ts"],
  symbol: "function",
  reference: {
    type: "typescript",
    package: "@ORGANIZATION/PROJECT-api",
    files: ["src/functional/**/*.ts"],
    symbol: ["function"],
  },
}
```

`files` selects modules and the population is what those modules publish, so a barrel carries in the surface it forwards. A `package` population is read from disk rather than from the program, because a symbol nothing imports is absent from the program and is exactly the one an obligation needs to name.

A unit is addressed the way a consumer reaches it, so `export * as functional` nests a segment and `export { A as B }` answers to `B`. Only TypeScript may cite TypeScript: `{@link}` resolves through the citing module's own imports, and no document has an import scope to resolve in.

### Symbol selectors

`symbol` picks which units a reference materializes, and on a claim it restricts which declarations may host a tag.

| Kind | Values | Default on a claim | Default on a reference |
| --- | --- | --- | --- |
| Markdown | `file`, `h1`, `h2`, `h3`, `h4` | all five | all five |
| Prisma | `model`, `column`, `relation` | all three | `model` |
| TypeScript | `type`, `function`, `property` | all three | `type` |
| Swagger | none, every operation is selected | not applicable | every operation |

Units keep their hierarchy, so a target acknowledges itself and every selected descendant: citing a heading covers its subsections, an interface covers its properties, and `prisma:Sale` covers the columns beneath it. An ancestor stays addressable even when its own kind is not selected. A reference may turn the cascade off for `@evidence` with `noAggregateEvidence` where the citing host does not own the whole subtree; an exclusion still covers the descendants of its target.

A declaration whose documentation carries `@internal`, `@hidden`, or `@ignore` leaves the population entirely. It owes nothing and can carry nothing, and citing one is reported rather than silently ignored.

### Exclusions

```md
<!-- @evidenceExclude docs/requirements/pricing.md#coupon-stacking
     This release ships a single coupon. Stacking waits for the settlement policy. -->
```

`@evidenceExclude <target> <reason>` records that a claim intentionally does not use a scope. It follows the same hierarchy as `@evidence`, affects only the claim it is written in, and one obligation may exclude a scope only once.

It is the only acknowledgement that settles an obligation without anything being built, so it exists to be vetoed. "Not applicable" is a conclusion rather than a reason.

```ts
{
  type: "typescript",
  files: ["src/components/**/*.tsx", "src/components/EXCLUSIONS.ts"],
  evidenceExcludeCarriers: ["src/components/EXCLUSIONS.ts"],
  symbol: "function",
  reference: { type: "markdown", files: ["docs/**/*.md"], symbol: "h2" },
}
```

`evidenceExcludeCarriers` confines them to a named ledger. Scattered through the population, reading every exclusion means reading the population; gathered in one file it means opening one file. An exclusion written anywhere else is reported where it sits and discharges nothing.

### Strict references

Ordinary coverage is permissive, which is right for a document several modules honor and too weak for a proof obligation, where one exclusion or one host citing everything discharges the whole population. Four properties tighten a single reference, and they never pool across references.

```ts
{
  type: "typescript",
  package: "@ORGANIZATION/PROJECT-api",
  files: ["src/functional/**/*.ts"],
  symbol: ["function"],
  noEvidenceExclude: true,
  singleEvidencePerSymbol: true,
}
```

- `noEvidenceExclude` refuses exclusions, so the target still owes positive evidence. A published accessor no hook consumes is an omission rather than a decision.
- `uniqueEvidence` allows at most one host per unit, so one host is answerable for it rather than several.
- `singleEvidencePerSymbol` requires exactly one unit from every selected host, so a host citing nothing and a host citing everything both fail.
- `noAggregateEvidence` answers each unit by its own name, so a positive citation of a scope containing them acknowledges none of them, and a citation of a selected unit still answers for that unit alone. It closes the path the other three leave open: one tag on a document's top heading otherwise discharges every requirement under it, including the ones nobody implemented. Like `role` it constrains positive evidence only, so an `@evidenceExclude` on that heading still decides the whole subtree; pair it with `noEvidenceExclude` where that is not an answer either.

Counting is by identity rather than by text. Repeated tags for one unit count once, an overload set stays one host, and citing a parent of two selected units counts as two, unless `noAggregateEvidence` has already confined the citation to the one unit it names.

### Relations

Those four count acknowledgements or confine them. `role` is the one that asks what an acknowledgement is.

```ts
{
  type: "prisma",
  files: ["prisma/schema/**/*.prisma"],
  symbol: "model",
  role: "produces",
}
```

```prisma
/// @evidence(produces) docs/requirements/recovery.md#reset Issues the one-time proof.
model password_resets {}
```

Without it every obligation is a reachability obligation: some host cites some unit. That cannot say a unit must be **produced** rather than merely mentioned, that a **read** is not discharged by a **write**, or that a test must prove an operation **works** rather than that it refuses. A model covered by a host that only consumes it reads as covered while nothing anywhere issues the rows.

A reference declaring a role is discharged only by positive evidence naming the same word. One naming another relation, or naming none, leaves the unit uncovered and the diagnostic says which relation it wanted. An `@evidenceExclude` names no relation and still answers, because it states that the claim does not cover the target rather than how it does; pair `role` with `noEvidenceExclude` where neither answer is acceptable. The vocabulary is yours: the rule checks that the relation asked for is the relation claimed, never that the claim is true, which is what a reviewer reads the reason for.

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
