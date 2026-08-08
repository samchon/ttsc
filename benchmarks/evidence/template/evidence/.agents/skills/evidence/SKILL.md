---
name: evidence
description: Defines the Evidence Graph tag grammar, per-citation reviews, truthfulness rules, claim activation, frozen configuration, behavioral proof, citations, exclusions, and the stub marker. Read before Evidence implementation or handling a graph diagnostic; backend.md and frontend.md carry the per-phase claims, placement, examples, and staged unlock.
---

# Evidence Graph

## Topics

- [backend.md](backend.md): the backend claims, their configurations, placement, examples, and the staged unlock order. Read before Backend Start.
- [frontend.md](frontend.md): the frontend claim chain, its configuration, placement, and staged unlock order. Read before Frontend Start.

## Tags

```text
@evidence <target> <reason>
@evidenceReview <target> <what you checked>
@evidenceExclude <target> <reason>
@evidenceExcludeReview <target> <what you checked>
```

`@evidence` states that the host implements, represents, or proves the target. `@evidenceExclude` states that the claim does not apply to the target and names the actual owner or observable alternative plus the condition that would invalidate the exclusion.

Target and non-empty reason are mandatory. One acknowledgement covers the selected target and its selected descendants. Write the reason as a specific responsibility current code could falsify, not a restatement of the target name.

## Reviews

Every acknowledgement carries a review of the same target: `@evidenceReview` beside each `@evidence`, `@evidenceExcludeReview` beside each `@evidenceExclude`. A review annotates a citation. It discharges no coverage and satisfies no obligation, so writing one can never change a graph diagnostic.

The reason and the review answer different questions. The reason says why this host answers for that target. The review says what you checked to know it does. Only the first is written unless something asks for the second, which is why an unverified citation and a verified one are otherwise identical bytes.

Name the artifact you read and the behavior you confirmed, in the form you actually worked from. "Confirmed" and "verified" are conclusions, not checks.

```ts
/**
 * @evidence docs/analysis/03-functional-requirements.md#req-order-checkout closes a cart into an order and reserves its stock
 * @evidenceReview docs/analysis/03-functional-requirements.md#req-order-checkout read the section's three rules and ran the checkout test: reservation, total, and the empty-cart refusal
 */
```

A symbol accumulating citations is the signal this rule exists to raise. Writing one honest review per target forces each to be defended separately, and citations that cannot share a single defensible check were never one responsibility. Split the symbol along the line the reviews expose rather than writing a review broad enough to cover both.

Every tag must truthfully describe the current host's relation to the target. Never write, move, consolidate, or invent an acknowledgement to pass the compiler: a diagnostic identifies an obligation, not the truthful acknowledgement for it, and a clean gate proves structure, not truth.

- Several hosts may cite the same target when each independently implements or proves it.
- One host cites one resolved target once.
- Within one claim-reference obligation, `@evidenceExclude` scopes never overlap each other or any `@evidence` scope, even across carriers.
- A parent target is truthful only when the host owns the complete selected subtree.

## Claim Activation

A claim with `disabled: true` is inactive even when its selector materializes a host; its configuration is still validated.

When the layer named by the adjacent comment is complete, delete that comment and the claim's final `disabled: true` property — nothing else — in the configuration that declares the claim. Do not replace it with `false` or restore it later.

An enabled claim is active only when its own `root`, `files`, and `symbol` selector materializes at least one selected host. With zero selected hosts the entire claim is inactive and none of its reference obligations runs. This applies to TypeScript, Prisma, and Markdown claims alike:

- TypeScript selects semantic exported symbols. Under `symbol: "function"`, an exported `const` initialized with an arrow or function expression is a function; an ordinary exported variable is a property and selects nothing.
- A Prisma `model` claim stays inactive until a matching schema input contains a model.
- A Markdown claim stays inactive until a matching document contains a selected host.

An unreadable or invalid configured input is not an empty population; loader and parse failures remain diagnostics. Inactivity defers a future layer's coverage until that layer has a host — it does not prove the requirements need no host.

Do not add, remove, or change claim objects as implementation advances — after `disabled` is deleted, activation follows the selected host population automatically.

## Frozen Configuration

A claim is declared in the configuration of the Program its hosts live in; [backend.md](backend.md) and [frontend.md](frontend.md) name each claim's configuration and why it lives there.

All three configuration files and every claim object are frozen except the prescribed `disabled` deletions. Keep `evidence/graph` and `evidence/review` at `error` in every gate; no environment value turns either off, and a result produced with one weakened is invalid. Do not create phase-specific config or compiler files, and do not add or remove a rule.

## Placement

Keep ownership evidence on the actual selected host; the per-phase documents table each claim's host and exclusion carrier. An exclusion carrier holds one reviewed exclusion per target scope and never holds ownership evidence. Providers are not selected hosts and carry neither tag.

## Behavioral Proof

Proof must be target-specific: the test or journey performs the relevant action and asserts the claimed result, refusal, state, or effect. Imports, registries, callability checks, and route or rendering smoke prove only availability and cannot carry unrelated requirements.

## Citations

TypeScript targets are cited as `{@link ...}` inline links resolved through the citing module's own imports. Import the SDK as a namespace — a default import binds the target under `default`, so `{@link api.functional...}` resolves to nothing. `import type` works for a citation-only import. The braces in `{@link ...}` are required.

## Exclusions

**Every `@evidenceExclude` goes in its claim's exclusion carrier and nowhere else**, and the compiler enforces it: each claim declares its carrier through `evidenceExcludeCarriers`, so an exclusion written on a working model, DTO, controller, test, screen, or journey is a build error naming the file it belongs in. A working host carries what it owns; the carrier carries what the claim does not cover. Keeping them apart lets a reviewer read every exclusion a claim has by opening one file.

A claim that declares no carrier accepts no exclusion at all. Write the missing work instead.

Use the narrowest truthful target. "Not applicable", "internal", "future work", and "not implemented" are conclusions, not reasons; name the actual owner or observable alternative and a concrete invalidating condition.

An exclusion states that this claim does not cover the target, never that the target is unfinished. If the layer owes the target and has not built it, the honest record is a build failure, so implement it rather than excluding it. An exclusion written to clear a diagnostic converts missing work into a green build, which is the one outcome this graph exists to prevent.

## Stub Marker

Mark unfinished work with:

```text
@todo <specific remaining implementation>
```

Place it on temporary controller and page stubs; remove it when the real provider delegation or completed screen replaces the stub.

On the backend the marker is also enforced: [backend.md](backend.md) stages `evidence/todo` to `error` once the tests are written, so every remaining tag reports itself as work left to do. Before a phase completes, its `@todo` sweep in the per-phase document must return nothing.

## Compiler Gates

The compiler owns target resolution, host eligibility, overlap, coverage, and missing acknowledgements. After each prescribed `disabled` deletion, fix the complete diagnostic batch and wait for a clean rebuild or reload; confirm no other claim configuration changed. The per-phase documents own the unlock order and its timing.

The compiler processes report type and lint diagnostics only — they cannot tell you a behavior stopped working — so run the runtime tests your objective requires. Never weaken the graph or falsify an acknowledgement to silence a diagnostic.
