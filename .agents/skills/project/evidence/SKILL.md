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
@evidenceExclude <target> <reason>
@evidenceReview <target> <description>
@evidenceReview <target> #<fingerprint> <description>
@evidenceExcludeReview <target> <description>
@evidenceExcludeReview <target> #<fingerprint> <description>
```

The target is one whitespace-delimited token, except that a target opening with `{@link`, `{@linkcode`, or `{@linkplain` runs to its closing brace. Everything after the target is prose. A declaration may carry any number of tags. Every tag requires a target and non-empty reason and is validated independently.

**There are two review tags because there are two acknowledgements, and a review of one never answers the other.** Verifying an `@evidence` means checking that the declaration does what the cited unit describes. Verifying an `@evidenceExclude` means checking that the unit genuinely does not apply here, which no reading of the declaration establishes and no coverage number reaches. One tag for both would let the easier verification discharge the harder one and leave a reader unable to tell which question was answered. So the pairing key is the acknowledgement kind together with the target, in the file rule and in the graph alike, which also lets one target be cited by one claim and excluded for another from the same host: two decisions, two reviews. A review filed under the wrong question is its own finding, because the author did the work and an orphan message would send them hunting a typo that is not there.

**A review is an annotation of a citation, never an acknowledgement of a unit, and it must not be a third `tagKind`.** Every acknowledgement map in evaluation consumes the declarations of a claim, so a review arriving through that parse discharges coverage, contributes a host to `uniqueEvidence`, counts a unit toward `singleEvidencePerSymbol`, and conflicts with an exclusion of the same scope. Each of those is a build going green because a review was mistaken for evidence. A distinct type cannot reach any of them by construction, where a shared one stays out only by being remembered at six sites. `declarationLine` needs no change to keep them apart: it matches `@evidence` only when the next character is whitespace, so `@evidenceReview` falls through exactly as `@evidenceExclude` does.

The `#`-prefixed fingerprint is optional in the grammar and required by a reference declaring `requireReview`. Its `#` is load-bearing for the reason a braced code target's braces are: the token discriminates itself instead of being guessed at, and a bare fixed-width hex token collides with ordinary prose. The exact length is checked as well as the prefix, because a requirement anchor such as `#req-search-policies` opens a description in that same shape.

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

Units form structural containment scopes. A Markdown file contains its heading outline; a heading contains lower-level headings until the next heading of equal or higher level. A Prisma model contains its columns and relations. A TypeScript interface or object-shaped type alias contains the members it declares, callables included, a class contains its selected members, and a namespace contains every nested public unit. Top-level TypeScript functions and properties have no aggregate file node. Swagger operations are independent leaves with no document or path aggregate target.

An `@evidence` target acknowledges the selected target and every selected descendant, and an `@evidenceExclude` target does the same unless its reference declares `noEvidenceExclude`. The reference's `symbol` selector defines the obligation denominator, not the only addressable targets: every structural ancestor of a selected unit remains resolvable as an aggregate scope.

Keep selected obligations and resolvable scopes separate. Do not make every unselected unit resolvable; only actual ancestors belong to the scope closure, or an unrelated same-name declaration can create false ambiguity.

Hierarchy is identity, not spelling. Store explicit parent unit IDs while materializing. Never infer TypeScript ancestry from a dotted-string prefix: literal names may contain dots, and `A.B` can mean one literal segment or two qualified segments.

**A declaration whose documentation comment carries `@internal`, `@hidden`, or `@ignore` materializes no unit, and neither does anything nested inside it.** The three tags are equivalent statements that the declaration is not API; the tag must open its own line, so prose mentioning one is describing something rather than declaring it, and text after it is a comment for humans. The graph honors a decision the source already made: without this, an author's only answers are a false `@evidence` citation or an `@evidenceExclude` whose reason restates the tag — and under `noEvidenceExclude`, not even the second one.

This applies to both sides and to both authored artifact kinds. A withdrawn declaration is neither a selected reference unit nor a selected claim host, and hosting nothing also makes it ineligible as an exclusion carrier. TypeScript JSDoc and Prisma `///` comments behave identically, and a tagged Prisma model takes its columns and relations with it. Markdown headings and Swagger operations have no authored documentation comment and are out of scope.

Keep a withdrawn unit rather than discarding it, marked with the tag that withdrew it. A citation naming one resolved to a real declaration, so it is answered with the tag as the cause; a bare unresolved target would send the author looking for a typo that is not there.

**Withdrawal belongs to the identity, and the host set is filled per declaration, so reconcile the two after materialization rather than while walking.** An identity may span several declarations, and a tag on any one of them withdraws it: an overload run and a merged interface are both one identity in two places. A collector filling the host set sees only the node in hand, so resolving withdrawal there closes the container it walks and no other, and there is one container per declaration form. Done that way twice, the untagged sibling stayed a claim host and an exclusion carrier, and a declaration the author had taken out of the API went on discharging coverage, silently, because the unit really was marked.

**Give a host position up only when every identity reaching it is withdrawn.** One node can host several: `export var price: number, live: number` is two identities sharing the statement TypeScript attaches their block to. Judging the position by the first withdrawn identity that names it refuses a citation on a public sibling nobody tagged, which is the same rule the mixed-variable-statement host set already states from the other direction. The example is `var` rather than `const` because withdrawing one identity of a statement takes a second declaration of it, and `const` cannot be redeclared.

**The reconciliation reaches exactly as far as the unit-to-node association does, and that is not yet everywhere.** A module-scope variable declarator is registered as a host and is not among its unit's recorded nodes, so a withdrawn variable identity keeps that one position. A second symptom sits beside it with a different cause: an inner declarator's own tag is never read, because a variable statement's withdrawal is taken from the statement wrapper. Recording the declarator closes the first and leaves the second untouched, so treating them as one thing closes half of it and calls it done. Naming the boundary is the point: this is one pass over finished identities rather than a per-container index, and it covers a declaration form nobody has written yet only to the extent that form records the nodes it hosts on.

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

- `"type"` selects exported interfaces, type aliases, classes, and namespaces. Enums are not type units.
- `"function"` selects exported function declarations, exported `const` declarations initialized with a function, every member written as a callable on a class, an interface, or an object-shaped type alias, and namespace variants of those forms.
- `"property"` selects every member of an exported class, interface, or object-shaped type alias that is not written as a callable, plus exported `const`, `let`, or `var` declarations at module or namespace scope. A `const` initialized with an arrow or function expression remains a function; every other variable at either scope, including a function-typed declaration or a function-valued `let` or `var`, remains a property, and so does every binding leaf of a destructured one however it was initialized.

**A class is a subject, so it is a unit and its members hang below it.** The class states what the thing is, a method states what it does, and a member variable carries a measured fact about it, which is the mapping the three selectors already spell. Instance members are addressed through `prototype` and static members directly. Only a public member materializes, and `private` or `protected` is the whole of that test, so an `abstract` or `override` member is selected exactly as its plain twin is. Constructors and accessors stay out: construction is how the subject comes to be and the class already answers for that, while an accessor, including an auto-accessor, is a get/set pair rather than a member variable. A type-only alias exposes the class name, because that name is type-space, and no member, because every member address runs through the class value the alias does not expose.

**A member written as a callable is a function, and "written as" is syntactic.** This is one rule over four spellings: a class body field, a constructor parameter property, an interface member, and an object-shaped type alias member. A method declaration and a method signature are callables; an overload run is one unit. This is the one place the variable rule inverts, at either scope: there an annotation never makes a callable and only a `const`'s function-valued initializer does, while a field's annotation counts too, because a field's declared type is its contract rather than a description of a value that already exists. The test is on the annotation as spelled, because these rules read no type checker: `charge: () => void` is a function, and `charge: Handler` is a property even where `Handler` aliases the same type, as are a constructor type and a union containing one. Only parentheses are seen through. Every restatement of this as "a field that holds a function" has been wrong, on four shipped surfaces, twice while correcting the previous one.

**A member is classified the same way whichever syntax declared it, and the exclusions travel with the classification.** An accessor is a get/set pair rather than a member variable wherever it is written, so a `get`/`set` signature materializes nothing on an interface or an object-shaped type alias just as an accessor does on a class, and a member with no citable name, whether nameless or computed, is refused on all three. An interface once answered `property` to `charge: () => void` while a class answered `function`, and a method signature materialized nothing at all, so a `symbol: "function"` claim over interfaces selected no host, deactivated, and passed with no coverage. A constructor parameter carrying a property modifier declares a field, so it materializes exactly what the same field written in the class body would, and the constructor's own visibility decides nothing about it. Take that modifier set from TypeScript's own mask rather than restating it: it holds five, and every enumeration written from the familiar four is short by `override`, whose meaning is about the base class rather than about the field, so it does not read as a field declaration. It still declares one. Classify both from one place: two independent classifications would let moving a field between the two syntaxes change its symbol kind, and that syntax dependence is the whole defect. Reclassifying a member moves it out of one selector as well as into another, and the losing direction is the silent one: a `property` reference stops counting a member that became a callable, and a `property` claim over interfaces holding only callables selects no host and deactivates. Say so wherever such a change ships, because the gaining direction announces itself with a diagnostic and the losing direction never does. The constructor is read for the fields it declares and hosts nothing itself, so a citation belongs on the parameter; a constructor's own block could not say which of two parameter properties it meant. Its withdrawal tag still cascades, because it is the one container that declares units without being one.

**A merged container that declares one member twice classifies it twice, and that is a known boundary rather than the rule.** The unit identity carries the symbol kind, so `interface I { charge: () => void }` beside `interface I { charge: Handler }` materializes a function unit and a property unit under one address, and a citation of that address is reported ambiguous. TypeScript accepts the source because the two annotations denote one type, and these rules read no checker, so nothing here can see that they do. The same two-unit shape is correct one line away: an interface merged with a same-named namespace really does declare two members, in two spaces, under one address. Both arrive at the collector identically, so a repair that folds the first would fold the second, and the distinction needs a decision rather than a patch.

Only public identities materialize. A top-level declaration needs an export modifier or local export-list alias; a namespace member needs to be exported from that namespace unless ambient namespace semantics make it implicitly public. A type-only alias projects public namespaces, interfaces, type aliases, classes, and every member an interface or object-shaped type alias declares, callables included, because those members are all type-space. It withholds value-space: namespace data, namespace functions, and every class member.

**A namespace merged with a same-named function is that function's static side, and nothing inside it materializes.** This is the generated SDK accessor shape: `get.path` and `get.METADATA` are properties of the `get` function value, and `get.Output` is the type its own signature spells, so none of them is authored contract. The exclusion is whole rather than per-kind, or one namespace would read as machinery under one `symbol` selector and as public surface under another. It also removes a resolution failure with no repair: a selected member promoted the merged namespace to an addressable aggregate scope, where it collided with the function unit of the same name and left every citation of the accessor ambiguous under the narrowest selector the diagnostic could recommend.

The merge partner decides this, not the namespace. An interface or a class merged with a same-named namespace is already one unit — both halves are symbol `type` under one identity — so a type family keeps every variant, and a companion namespace beside a class is authored contract rather than accessor machinery. Both shapes keep the population they have. A `const` or `let` cannot merge with a namespace at all; TypeScript rejects it as `TS2451`.

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

A reference may strengthen its own acknowledgement relation with `noEvidenceExclude`, `uniqueEvidence`, `singleEvidencePerSymbol`, and `requireReview`, declared flat on the reference object. Every option is opt-in, its false value is the historical behavior, and constraints never cross or pool between reference-array elements — including identical and overlapping references.

- **A refused exclusion is reference-local.** Report one diagnostic for the declaration and reference, give that reference no coverage from it, and leave the missing positive coverage visible. The same declaration may still satisfy another reference that allows exclusions.
- **`uniqueEvidence` counts distinct semantic claim hosts per selected unit.** Declaration merging and overloads remain one host, several tags on one host count once, and an exclusion never contributes a host. A unit no host cites is reported as missing coverage instead.
- **`singleEvidencePerSymbol` counts distinct selected units per claim host.** Begin from the complete selected host population so a host with no tag counts as zero, and count reference-unit identities reached by `@evidence`, including every selected descendant of an aggregate scope. Do not count tags, source positions, or exclusions.
- **`requireReview` makes an acknowledgement expire.** Every acknowledgement of the population owes an `@evidenceReview` or `@evidenceExcludeReview` to match its tag, on the same host naming the same target, carrying a fingerprint of the cited scope's current content. Report exactly one of missing review, missing fingerprint, or stale fingerprint, because each repair subsumes the next, and state the expected value in every one: the hint API publishes only on a cycle where the rule reports nothing, so the cycle that needs the value is the cycle that offers none.
- **A fingerprint is a property of the cited address, not of the reference.** It covers the unit and its structural subtree. `UnitsByScope` is per reference while a tag carries one token, so a covered-set digest would let two references citing one scope demand two values from it and no value could satisfy both. A reference that confines acknowledgement does not narrow this; the citation still names the scope, and re-reviewing when the subtree moves is conservative rather than wrong.
- **A digest excludes every position a tag can occupy, and normalizes before hashing.** HTML comments in Markdown and documentation blocks in TypeScript come out, or writing the review changes the digest its own fingerprint is checked against, and the repair never terminates. That is not only self-citation: a property's block is interior text of the type containing it. Line endings collapse and trailing whitespace goes, or one commit expires every review on a CRLF checkout and none on an LF one.
- **How much of a unit its digest covers differs by artifact, and the Markdown intuition does not carry.** A document partitions into disjoint regions, so a heading's digest is independent of its subsections. A declaration does not partition: `interface ISale` textually contains the members it declares, so a TypeScript unit's digest covers every nested member whether or not that is wanted. Two consequences follow and both are deliberate. A nested change moves its own unit's digest and every enclosing unit's, which composition would do anyway. And churn behind `@internal` expires a review of the enclosing type, because a withdrawn member's body sits inside that declaration's text and no substitution in the composite can remove it; a withdrawn unit contributes the tag that withdrew it so the withdrawal itself is visible, and nothing more. Do not build on an assumption that a unit's digest is independent of its subtree.
- **A population whose loader reports identities rather than content cannot require a review.** Swagger and Prisma cross a process boundary that carries `{method, path}` and a model's field names, so no per-unit fingerprint exists. Refuse the option at decode. Do not substitute the whole-source digest both loaders already return: one value shared by every unit of a document expires every review in it on every regeneration, which communicates nothing.
- **Incomplete populations establish no cardinality.** Preserve the loader failure and derive no count from a partial denominator. A healthy population that is merely empty is a complete denominator, so a host still truthfully cites zero units against it.

Completion keeps every positive target. At the exclusion trigger, omit a target selected only by references that refuse exclusions, and keep one any enabled reference still allows. The hint API has no cursor or claim context, so cardinality stays an evaluation diagnostic rather than a completion filter.

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
- **A merged identity reports the declaration encountered first.** Order is source position, never declaration kind, so `namespace ISale` written above `interface ISale` is the one every diagnostic names. This holds for a class merge too. `TS2434` refuses only an _instantiated_ namespace written before its class, so a type-only companion namespace, and any namespace in an ambient context, may legally come first and then be the declaration the merge reports.
- **A citation may sit on any declaration of a merged identity.** The relation is judged on the identity, so placement changes neither resolution nor coverage and is not worth a diagnostic.
- **The unit model decides which declarations a citation may sit on.** An enum registers no host, so a tag on one is an unsupported host however public the enum is. `evidence/documented` asks nothing of it for the same reason, while `evidence/singular` still counts it as an identity — that rule is about a file's public surface, where the enum is part of it.
