---
name: project/evidence
description: Defines the evidence graph domain model for @ttsc/evidence — the tag grammar, node kinds, hierarchy, reference resolution, obligation coverage, reference policies, and exclusions. Use before changing rule semantics, the tag grammar, the configuration surface, or a diagnostic message; do not use for the mechanics of the Go rule API, which the `@ttsc/lint` contributor contract in packages/lint/README.md owns.
---

# Evidence Graph

## Product Contract

An artifact that cites nothing has no proof it was needed. An artifact that cites a target no configured source declares has proof of nothing. `evidence/graph` turns both states into compile errors under the graph the consumer defines in `lint.config.ts`.

The graph is configurable. Claims select the files and declaration hosts that owe acknowledgements; references select the evidence populations they owe. Every claim-reference pair is an independently complete obligation, and every element of a reference array remains separate.

## Tag Grammar

```text
@evidence <target> <reason>
@evidence(<relation>) <target> <reason>
@evidenceExclude <target> <reason>
```

The target is one whitespace-delimited token, except that a target opening with `{@link`, `{@linkcode`, or `{@linkplain` runs to its closing brace. Everything after the target is prose. A declaration may carry any number of tags. Every tag requires a target and non-empty reason and is validated independently.

The parenthesized relation is optional, names what the acknowledgement claims, and only `@evidence` takes one. An exclusion states that the claim does not cover the target rather than how it does, so there is no relation for it to name.

It is one token immediately after the tag name, carrying no whitespace and no parenthesis — the same set the configuration accepts, so a relation a tag can name and a relation a reference can require are one vocabulary. The space in `@evidence (target)` is what keeps that form meaning what it always meant.

Consume nothing else in that position. A malformed opener, a well-formed one with no separator after it, and a relation on an exclusion all stay in the body and become the target, reported as an unresolved target when a reason follows it and as a malformed declaration when the parenthesis was the whole body. Ceasing to be a declaration would drop an acknowledgement without a word, and the missing-unit diagnostic names the reference rather than the tag, so nothing else would point at the line.

```ts
/** @evidence docs/spec.md#pricing Sale price derives from this section. */
/** @evidence POST:/members Member creation follows this API operation. */
/** @evidence {@link ISale} The complete sale contract is mirrored here. */
```

The two forms are two resolvers, and the token itself says which. A path address resolves against configured sources; an inline link resolves through the citing module's imports, so the citation is a real reference rather than a string that spells a symbol's name.

**The braces are load-bearing, not decoration.** TypeScript resolves a name inside an inline link and counts it as a use, so an import that exists only to support a citation survives `noUnusedLocals`. It does not resolve names inside an unknown tag, so an unbraced symbol target leaves the import unreferenced and raises `TS6133`. Recommend `import type` for a citation-only import: it is erased at emit, creating no runtime dependency or cycle. A consumer also running `@typescript-eslint/no-unused-vars` still sees a false positive there, because that rule does not count JSDoc usage.

Keeping the discrimination in the token is what preserves the parser's independence from reference context. Without a boundary character, `POST /members` would have to be guessed at, which is why a path target stays one token and only a code target may spend braces to buy one.

**Only a TypeScript claim may cite TypeScript evidence.** An inline link resolves in the citing module's import scope, which no other artifact has, so any other claim would have to match a bare name against one repository-wide table — and that makes symbol-name uniqueness across the whole repository load-bearing. The configuration refuses the pairing at decode, and resolution refuses a code target reached through another claim's reference, because addresses are indexed from every claim at once and the guard alone left that door open. Both halves are needed; either alone is silent. What this gives up is that documentation can no longer cite code, and the inverse obligation is not the same one, and the reversal was deliberate.

The reason exists for review, not machine judgment. Do not add a rule that guesses whether prose is sincere; it will teach authors to write filler that passes.

## Units And Hierarchy

Four artifact kinds materialize evidence units.

- **Markdown** — a file addressed as `<path>` or an H1-H4 ATX section addressed as `<path>#<anchor>`.
- **Prisma** — a model addressed as `prisma:<Model>` and one of its members addressed as `prisma:<Model>.<member>`.
- **Swagger** — a reference-only Swagger/OpenAPI document whose operations under `paths` are addressed as `<UPPERCASE_METHOD>:<path>`.
- **TypeScript** — an exported type, function, or property addressed by its qualified public name.

Units form structural containment scopes. A Markdown file contains its heading outline; a heading contains lower-level headings until the next heading of equal or higher level. A Prisma model contains its columns and relations. A TypeScript interface or object-shaped type alias contains its direct properties, and a namespace contains every nested public unit. Top-level TypeScript functions and properties have no aggregate file node. Swagger operations are independent leaves with no document or path aggregate target.

An `@evidence` target acknowledges the selected target and every selected descendant, unless its reference declares `noAggregateEvidence` and confines it to the target itself. An `@evidenceExclude` target always acknowledges the whole of that scope; what a reference may do about an exclusion is refuse it outright with `noEvidenceExclude`, which is a different decision from confining one. The reference's `symbol` selector defines the obligation denominator, not the only addressable targets: every structural ancestor of a selected unit remains resolvable as an aggregate scope.

Keep selected obligations and resolvable scopes separate. Do not make every unselected unit resolvable; only actual ancestors belong to the scope closure, or an unrelated same-name declaration can create false ambiguity.

Hierarchy is identity, not spelling. Store explicit parent unit IDs while materializing. Never infer TypeScript ancestry from a dotted-string prefix: literal names may contain dots, and `A.B` can mean one literal segment or two qualified segments.

**A declaration whose documentation comment carries `@internal`, `@hidden`, or `@ignore` materializes no unit, and neither does anything nested inside it.** The three tags are equivalent statements that the declaration is not API; the tag must open its own line, so prose mentioning one is describing something rather than declaring it, and text after it is a comment for humans. The graph honors a decision the source already made: without this, an author's only answers are a false `@evidence` citation or an `@evidenceExclude` whose reason restates the tag — and under `noEvidenceExclude`, not even the second one.

This applies to both sides and to both authored artifact kinds. A withdrawn declaration is neither a selected reference unit nor a selected claim host, and hosting nothing also makes it ineligible as an exclusion carrier. TypeScript JSDoc and Prisma `///` comments behave identically, and a tagged Prisma model takes its columns and relations with it. Markdown headings and Swagger operations have no authored documentation comment and are out of scope.

Keep a withdrawn unit rather than discarding it, marked with the tag that withdrew it. A citation naming one resolved to a real declaration, so it is answered with the tag as the cause; a bare unresolved target would send the author looking for a typo that is not there.

## Swagger Classification

Swagger is reference-only. One `ITtscEvidenceGraphSwaggerReference` owns one exact project-relative file path or HTTP(S) URL through its singular `file` property; multiple documents are separate reference-array obligations. It has no public `symbol` selector because every operation under the normalized document's `paths` object is selected.

Normalize Swagger 2.0 and OpenAPI 3.x JSON/YAML inputs with `@typia/utils` to `@typia/interface`'s `OpenApi.IDocument` before materializing operations. Standard and additional operation methods become uppercase targets such as `POST:/members`; preserve the OpenAPI path exactly. Webhooks and component schemas are outside this artifact kind.

Keep the target one whitespace-delimited token. Do not parse `POST /members` as a two-token target: the parser has no reference context, and doing so would reinterpret a TypeScript target `POST` whose reason begins with `/members`.

## Prisma Classification

A Prisma schema works in both directions: its models ground claims, and its `///` comments host them. Selectors are `model`, `column` for a stored field, and `relation` for a relation field. A reference defaults to `["model"]` and a claim to all three, because a reference default promises a denominator while a claim default only decides where a tag may sit.

**The classification is Prisma's, not ours.** Every configured file is parsed together as one schema by Prisma's own parser, which is what separates a column from a relation — a relation has two sides, only one usually carries `@relation`, and the back-reference carries no attribute at all. A **view** arrives among that parser's models and is therefore a `model` unit; the name argues otherwise, which is exactly why it was measured. Enums, composite types, and indexes are outside the unit model.

**That parser returns no position for anything, so a native scan supplies every location.** The scan is subordinate: it may not add a unit, remove one, or change a symbol kind, so a scan that misses costs a precise line and never a smaller coverage denominator. Keep it that way — the moment it decides what exists, a mis-scan turns into a silently passing build.

A model name is unique across the whole schema folder, so a target never names the declaring file and moving a model between files cannot break a citation. A Prisma identifier can never contain a dot, so joining a member address on one is unambiguous — the hazard that keeps TypeScript identities segmented does not exist here.

`///` and `/* */` both host a declaration, and `//` does not. That split is Prisma's rather than ours and was settled by running `prisma generate`: both documentation forms reach the generated client types and prisma-markdown's ERD indistinguishably, while a `//` comment is discarded outright. A citation in a `//` comment is therefore **reported** rather than ignored, as is one buried behind an extra slash — `//// @evidence` arrives as content beginning with a slash and opens no tag. A blank line detaches a top-level comment but not a field's, an intervening `//` line does not break a run, and a comment above a block attribute or a closing brace documents nothing. Do not re-derive these from the grammar; both directions are silent when wrong.

## TypeScript Classification

Selectors classify public contracts semantically.

A TypeScript claim may declare `root` to move the base its `files` globs resolve against. This changes only population addressing: the claim still materializes exclusively from `ctx.Sources`, and the root never scans a directory, follows arbitrary imports, or admits `node_modules`. A sibling package must therefore be an explicit root of the active tsconfig Program. Targets remain symbol identities, while file matching is root-relative and diagnostics retain project-relative locations.

- `"type"` selects exported interfaces, type aliases, and namespaces. Classes and enums are not type units.
- `"function"` selects exported function declarations, function-valued exported `const` declarations, public class callables, and namespace variants of those forms.
- `"property"` selects direct properties of exported interfaces and object-shaped type aliases plus exported `const`, `let`, or `var` declarations at module or namespace scope. A `const` initialized with an arrow or function expression remains a function; every other variable, including a function-typed declaration or function-valued `let` or `var`, remains a property.

Only public identities materialize. A top-level declaration needs an export modifier or local export-list alias; a namespace member needs to be exported from that namespace unless ambient namespace semantics make it implicitly public. A type-only namespace alias projects only public namespaces, interfaces, type aliases, and their type properties, never value-space data or callables.

**A namespace merged with a same-named function is that function's static side, and nothing inside it materializes.** This is the generated SDK accessor shape: `get.path` and `get.METADATA` are properties of the `get` function value, and `get.Output` is the type its own signature spells, so none of them is authored contract. The exclusion is whole rather than per-kind, or one namespace would read as machinery under one `symbol` selector and as public surface under another. It also removes a resolution failure with no repair: a selected member promoted the merged namespace to an addressable aggregate scope, where it collided with the function unit of the same name and left every citation of the accessor ambiguous under the narrowest selector the diagnostic could recommend.

The merge partner decides this, not the namespace. An interface merged with a same-named namespace is already one unit — both are symbol `type` under one identity — so a type family keeps every variant. A class registers no unit under its own name, so `class C` beside `namespace C` never had two units to collide. Both shapes keep the population they have. A `const` or `let` cannot merge with a namespace at all; TypeScript rejects it as `TS2451`.

**A re-export decides reachability, never identity.** The rule splits in two, and both halves are load-bearing.

- **Identity stays with the declaring file.** A re-export whose declaration lives in another file creates no second unit. A symbol exposed through two barrels is one unit with one ID and one coverage obligation — this is what stops a barrel from doubling every obligation beneath it.
- **Reachability comes from the selected modules.** A TypeScript reference selects modules, and traversal follows `export *`, `export * as ns`, and `export { A as B }` from each of them to decide _membership_ in the population, giving every reached symbol its accessor path from the module that published it. `export * as functional` nests a segment, `export * from` flattens one, and an alias is addressed by its public name. A module's own inventory names a declaration by what that module exposes it as, so `export { a as b }` is one unit called `b`; matching it by the local binding finds nothing.

**Narrowing an installed package separates the two halves.** A `package` reference with `files` uses its matched modules to decide membership and the package's declaration entry to decide addresses. Making a matched module the address root instead collapses `functional.health.get` to `get`, while an inline link still resolves under the entry — the only module a consumer's specifier reaches — so no spelling of the target resolves and the narrowing defeats the adoptability it exists for. A unit the entry does not publish has no address anyone can write, so it is reported as an empty population rather than selected.

A symbol reached by two paths therefore answers to two addresses and still materializes one coverage unit. Build those addresses from identity segments rather than by rewriting a joined target, or a literal dot inside a name collapses into qualification. An address is legal in the module that publishes it rather than everywhere, so record the module-and-address pair; import-scope resolution then keeps two modules publishing one declaration from competing.

Containment among reached units follows the declaration hierarchy, never the address text. A type and a callable may share one public name, so treating a common address prefix as ownership would make an unrelated same-name declaration an ancestor and turn every citation of that name ambiguous.

A mixed variable statement can carry both function and property host kinds because TypeScript attaches one leading JSDoc block to the statement wrapper. Every public leaf of an object or array binding pattern is a property under its local binding name. Preserve the host set; choosing one kind makes the other selector spuriously out of scope.

## Evaluation

`evidence/graph` evaluates the complete configured graph once per Program and answers three distinct questions.

- **Resolution.** Does every declaration target resolve to exactly one selected unit or structural ancestor?
- **Host eligibility.** Does `@evidence` live on a symbol kind selected by its claim, or does `@evidenceExclude` live on an eligible carrier in a matching claim file?
- **Coverage.** Does every selected reference unit have at least one acknowledgement in this claim, and does that acknowledgement satisfy whatever the reference's own policy demands of it?

Keep claim and reference state separate. A declaration that satisfies one claim or reference never leaks coverage into another, even when the physical target is the same.

Several declaration hosts may acknowledge the same unit with `@evidence`, unless the reference declares `uniqueEvidence`; one requirement can need several implementations or proofs. One declaration host may state one resolved evidence scope only once.

`@evidenceExclude` is one reviewed non-applicability decision per scope in one claim-reference obligation. Exclusion scopes must not overlap each other. An evidence scope and exclusion scope must not overlap because they state opposite intent. Report one duplicate or conflict diagnostic per later overlapping scope rather than one per descendant.

## Reference Policies

**A prescription belongs to the thing being cited, not to the obligation that noticed it.** Compute every sentence telling an author how to write a tag from the obligations that own the cited thing, narrowed by the target when the target says what it is and widened to every candidate when it does not, and name a tag all of them accept. A diagnostic scoped to one reference may name that reference as its reason, never as its grammar.

**An option's zero value is the absence of a constraint, never a constraint of its own.** An omitted `role` accepts any relation rather than requiring that none be named, and an omitted switch leaves the historical behavior rather than asserting its opposite. Every reader of a policy field owes that reading, including a diagnostic deciding what to prescribe when several obligations own one declaration.

A reference may strengthen its own acknowledgement relation with `noEvidenceExclude`, `uniqueEvidence`, `role`, `noAggregateEvidence`, and `singleEvidencePerSymbol`, declared flat on the reference object. Every option is opt-in, its zero value is the historical behavior, and constraints never cross or pool between reference-array elements — including identical and overlapping references.

- **A refused exclusion is reference-local.** Report one diagnostic for the declaration and reference, give that reference no coverage from it, and leave the missing positive coverage visible. The same declaration may still satisfy another reference that allows exclusions.
- **`uniqueEvidence` counts distinct semantic claim hosts per selected unit.** Declaration merging and overloads remain one host, several tags on one host count once, and an exclusion never contributes a host. A unit no host cites is reported as missing coverage instead.
- **`singleEvidencePerSymbol` counts distinct selected units per claim host.** Begin from the complete selected host population so a host with no tag counts as zero, and count reference-unit identities reached by `@evidence`, including every selected descendant of an aggregate scope the reference has not confined. Do not count tags, source positions, or exclusions.
- **`noAggregateEvidence` confines a positive acknowledgement to the unit its target names.** Narrow the covered set at the scope lookup rather than at each consumer, so acknowledgement, conflict pairing, `uniqueEvidence` hosts, and `singleEvidencePerSymbol` counts all agree; a cited parent of two selected units then counts as one rather than two. A citation covering nothing after narrowing reports at its own location, naming only the obligations that refused it, and stays silent when another obligation took the same tag. Narrow behind the carrier, eligibility, and health gates: a tag on an ineligible host is already wrong for a reason this finding would mask, and the repair it offers cannot be performed there. The relation gate is a sibling rather than a predecessor, so one reference refusing a tag both ways records both before either stops the obligation; reporting whichever came first costs the author a build. It constrains positive evidence only, for the reason `role` does.
- **`role` asks what an acknowledgement is rather than how many there are.** It constrains positive evidence only: only `@evidence(<role>)` naming the same word discharges the reference, while an exclusion still answers because it states that the claim does not cover the target rather than how it does, and `noEvidenceExclude` is what refuses one. A declaration whose relation every obligation it reached refuses reports at its own location, since the missing-unit diagnostic names the reference rather than the tag. Reject a configured relation carrying whitespace or a parenthesis: no tag could name it, so every unit would owe an acknowledgement no author could write.
- **Incomplete populations establish no cardinality.** Preserve the loader failure and derive no count from a partial denominator. A healthy population that is merely empty is a complete denominator, so a host still truthfully cites zero units against it.

`noAggregateEvidence` needs no completion treatment. Every target the corpus offers is a selected unit, and a selected unit always covers itself, so no offered target is one a confining reference refuses. `role` earns a trigger only because `@evidence ` cannot match a line that opens a parenthesis.

Completion keeps every positive target. At the exclusion trigger, omit a target selected only by references that refuse exclusions, and keep one any enabled reference still allows. A configured relation earns its own trigger, `@evidence(<relation>) `, because the host matches a trigger against the line prefix and `@evidence ` never matches a line that opens a parenthesis. It carries the targets that relation discharges and the targets of every reference requiring no relation, since those accept any; the plain trigger carries only the second set. The hint API has no cursor or claim context, so cardinality stays an evaluation diagnostic rather than a completion filter.

## Exclusions

`@evidenceExclude` records that one claim intentionally does not use a target scope. On a reference that allows exclusions it has the same hierarchy and coverage cardinality as `@evidence`, and only its reviewed intent differs.

Three properties are load-bearing.

- **The reason is mandatory.** A blank exclusion is not a decision anyone can review.
- **It belongs to one claim.** Another claim referencing the same source still owes its own acknowledgement.
- **It follows hierarchy.** Excluding a parent excludes every selected descendant. Another exclusion covering any of those units is a duplicate, while overlapping evidence is a conflict.

Carrier eligibility is intentionally wider than ownership evidence and no wider than the claim's file population.

- A TypeScript exclusion may sit on any supported public export in a matching claim file, even when the claim's `symbol` selector chooses another host kind. Unexported and unsupported declarations remain ineligible.
- A Prisma exclusion may sit on a selected model or field host, or in an unattached top-level `///` run in a matching claim file. This permits a lint-only `.schema` ledger outside Prisma generation. The same unattached position never accepts `@evidence`.
- Markdown and Swagger claim hosts retain their selected-symbol behavior.

Never auto-exclude, auto-retarget, or delete an artifact or citation to make a graph green. Repair is the author's, and every diagnostic must name the path that performs it.

## Diagnostic Messages

Most users meet this plugin only through an error message. State what is wrong, then what fixes it. Name the claim, reference, target, source location, and supported repair. Prefer one precise diagnostic to several descendant duplicates.

## Identity Rules

- **Targets are exact tokens.** Prose is free, but target identity never depends on heading text beyond its generated or explicit anchor.
- **Paths are case-sensitive identity on every host.** Case-insensitive comparison may improve a diagnostic but never decides equality.
- **Markdown separators normalize only for Markdown targets.** Do not rewrite TypeScript literal symbol names.
- **Swagger methods canonicalize to uppercase; Swagger paths do not normalize.** `POST:/members` and `POST:/Members` are distinct.
- **A Prisma target carries its `prisma:` prefix and never a file path.** The prefix is what stops a model named `Sale` from competing with a TypeScript type of the same name in the one address map every reference shares.
- **Qualified TypeScript segments stay encoded internally.** This prevents a literal dot from collapsing into namespace or property qualification.
- **A merged identity reports the declaration encountered first.** Order is source position, never declaration kind, so `namespace ISale` written above `interface ISale` is the one every diagnostic names.
- **A citation may sit on any declaration of a merged identity.** The relation is judged on the identity, so placement changes neither resolution nor coverage and is not worth a diagnostic.
- **The unit model decides which declarations a citation may sit on.** A class registers no host, so `class Sale` beside `namespace Sale` leaves the namespace as the only declaration that can carry a tag for `Sale`. `evidence/documented` demands the block on the same declaration for the same reason, while `evidence/singular` still counts the pair as one identity — that rule is about a file's public surface, where the class is part of it.
