---
name: project/evidence
description: "Defines the evidence graph domain model for @ttsc/evidence: the tag grammar, node kinds, hierarchy, reference resolution, obligation coverage, reference policies, and exclusions. Use before changing rule semantics, the tag grammar, the configuration surface, or a diagnostic message; do not use for the mechanics of the Go rule API, which the `@ttsc/lint` contributor contract in packages/lint/README.md owns."
---

# Evidence Graph

Read the user-facing [Evidence Tags](../../../../website/src/content/docs/evidence/tags.mdx) and [Configuration](../../../../website/src/content/docs/evidence/claims.mdx) guides first. They own tag grammar, targets, scope, withdrawal, reviews, claims, selectors, policies, checklists and exclusion carriers.

This skill owns the implementation invariants behind those semantics. The Go rule API belongs to the `@ttsc/lint` contributor contract in `packages/lint/README.md`.

## Contents

- [Tag Parsing](#tag-parsing)
- [Units And Hierarchy](#units-and-hierarchy)
- [Swagger Classification](#swagger-classification)
- [Prisma Classification](#prisma-classification)
- [TypeScript Classification](#typescript-classification)
- [Evaluation](#evaluation)
- [Reference Policies](#reference-policies)
- [Exclusions](#exclusions)
- [Diagnostic Messages](#diagnostic-messages)
- [Identity Rules](#identity-rules)

## Tag Parsing

Represent a review as an annotation of a citation, with a distinct type outside `tagKind`. A review must never enter acknowledgment maps, discharge coverage, add a host to `uniqueEvidence`, count toward `singleEvidencePerSymbol` or conflict with an exclusion. A distinct type enforces that boundary instead of relying on every consumer to remember an exclusion guard.

Keep `declarationLine`'s whitespace boundary after `@evidence`. It distinguishes `@evidenceReview` and `@evidenceExclude` without changing their shared prefix.

Check a fingerprint's exact length as well as its opening `#`. A requirement anchor such as `#req-search-policies` has the same opening shape.

Decide a target's kind from its token independently of reference context. A path target is one token; only a code target may use braces as a boundary. A citation-only import remains unused to `@typescript-eslint/no-unused-vars` because that rule does not count JSDoc usage.

Resolve a file-qualified target's path from the citing file and its segmented accessor from that module's public exports. Preserve import-scoped inline links and reject bare cross-module symbol lookup.

An explicit TypeScript reference `root` opts into disk loading. Its `files` select entry modules under that root, and re-export traversal stays inside it. Active Program snapshots take precedence over disk for the same module.

Declare that rooted directory through `ProjectInputs` before loading. Creation, deletion, repair and re-export changes must refresh watch and editor diagnostics. Without `root` or `package`, entry selection stays Program-only. File-qualified resolution retains declaration IDs and policy state; a failed lookup never supplies coverage.

Reasons are reviewed by humans and agents. Do not add a rule that guesses whether prose is sincere; such a rule rewards filler that satisfies its heuristic.

## Units And Hierarchy

Keep selected obligations separate from resolvable scopes. Add only actual ancestors to the scope closure. Making unrelated unselected units resolvable can create same-name ambiguity.

Store explicit parent unit IDs during materialization. Do not infer TypeScript ancestry from dotted-string prefixes: a literal name may contain dots, and `A.B` may denote one segment or two.

Retain a withdrawn unit with its withdrawal tag. A citation of that identity must name the tag as the cause rather than report an unexplained unresolved target.

Reconcile withdrawal after materialization, across every declaration of an identity. A tag on any declaration withdraws the whole identity, including overloads and merged interfaces. A declaration-local walk cannot remove hosts registered by another declaration form.

Treat a host position as a node-and-symbol-kind pair. Release it only when every identity of that kind reaching the node is withdrawn. For example, `export var price: number, live: number` shares one statement documentation position; withdrawing one identity must leave the public sibling citable. The `var` example permits a second declaration to withdraw one identity; `const` cannot be redeclared.

Record every host position among its unit's nodes, including variable declarators at module and namespace scope. Per-host counts, withdrawal and review pairing all depend on that association. Read an inner declarator's own withdrawal tags as well as its container's; container documentation does not substitute for that read.

The statement wrapper and inner declarator are positions of the same variable identity. A review on either position may answer a citation on the other. Changes to these associations can both expire and newly satisfy reviews; document both effects when the association changes.

Keep position ownership separate from content used for fingerprints. A variable owns its statement wrapper because TypeScript attaches leading documentation there, but its content is its own declarator: name, annotation and initializer. Sibling declarators must not enter its fingerprint.

Destructuring leaves share the declarator and initializer that produce their values. Do not hash a binding identifier's leading trivia as content: it may include documentation whose tag positions must be excluded. A narrowed variable digest also changes enclosing-scope fingerprints; document the resulting review expiries when changing that boundary.

Report a unit's position inside its declaration's own name. A full start may point before leading trivia, above a multiline destructuring leaf or before documentation between comma-separated declarators.

Read tags only from documentation blocks attached by the parser. This keeps the citation, its host and the text excluded from a digest associated with one position. Binding elements have no attached documentation, so do not invent an association for a block inside a destructuring pattern.

Report unsupported tags in `//` comments, runs of three or four slashes and commented-out code. Judge each line independently. Offer both repairs: move an intended citation into a declaration's documentation block, or remove an abandoned tag.

Confine that reporting to the claim populations as declared, including inactive claims. A file whose declarations are all commented out still belongs to those declared globs. Program files outside every matching claim glob are out of scope, including dependency files. Package-reference globs select installed package files and confer no claim ownership here.

Report a scan problem to every population reading that file, matched against that population's own symbol set. A malformed heading or unaddressable path can lose either reference units or claim hosts. A file-level problem uses the wildcard symbol because it concerns the file, not one heading kind.

Judge claim scan problems before activation, so a file that empties its claim still reports its cause. Judge reference scan problems only after activation: inactive claims do not run their reference loaders. Do not combine these into one activation rule.

## Swagger Classification

One `ITtscEvidenceGraphSwaggerReference` owns one document through its singular `file`. It has no public `symbol` selector; every operation under the normalized document's `paths` is selected.

Normalize with `@typia/utils` to `@typia/interface`'s `OpenApi.IDocument` before materializing operations. Return each operation's identity and digest from the bridge that understands that document.

Resolve every `$ref` into `components.schemas` before hashing, following a self-referential schema once. The converter preserves references rather than inlining them; hashing only a referenced name would miss a change to its DTO.

An operation is the unit, hosts no interior evidence tags and has no subtree to compose. Exclude no interior content. A remote source has no local bytes to revalidate; its fingerprints describe the document returned by its one fetch.

## Prisma Classification

Compute per-unit fingerprints in the bridge that understands each declaration. Hash each model's and member's parsed declaration without its documentation comment, where reviews are written.

A model's own digest excludes its fields. Fields are separate units composed by the scope; including them in the model digest would make one field edit expire every sibling's review.

Read types, attributes and arguments from the parser's values rather than reconstructing them from source text. `@@unique` and `@@map` change the model digest; `@@index` changes no unit. Parser or converter upgrades may change every fingerprint of that artifact kind.

Keep the composite source digest as a cache key over the ordered file set and its paths. Per-unit Prisma digests exclude file paths: model names are unique across a schema folder, and moving a model must not break its citation.

Compose the schema from physical files. Use `os.SameFile` to deduplicate hard links, linked directories and aliases on case-insensitive volumes. A parser rejects a set that declares one model twice. Share the resulting units and declarations across inventories of that physical file; copied identities would owe obligations twice.

Use Prisma's classification. Views arrive as models and are `model` units. Enums, composite types and indexes are outside the unit model.

Supply locations through a native scan because the parser returns none. The scan may not add or remove a unit or change its kind; a missed position loses precision, never coverage denominator.

Prisma identifiers contain no dots, so joining a member address with a dot is unambiguous.

Accept `///` and `/* */` documentation; both reach generated client types and prisma-markdown's ERD. Discard `//` comments as documentation. `//// @evidence` begins with slash content and opens no tag, so report it like a `//` citation. An intervening `//` line does not break a documentation run.

## TypeScript Classification

Spell diagnostic locations project-relative unless no relative spelling exists. When a diagnostic names a configuration's `root` property, use its declared spelling, normalized but unresolved, for every artifact kind. The author must be able to find that value in the named configuration.

Materialize a class as a unit with members beneath it. Preserve the instance/static split across merges: an interface merged with a class contributes `prototype` members; a namespace merged with it contributes bare static members. Both declarations of a member must share its walkable address and identity.

Determine public visibility from `private` and `protected` alone. `abstract` and `override` members remain selected like their ordinary counterparts.

A type-only alias exposes the class name but no class members: their addresses require the class value. Withhold a merged interface's members with that class. Keep this guard on the merged identity rather than only the class collector.

Apply type-only withholding to declaring-file export lists, inline `export { type Sale }`, type-only projections and re-exports: `export type { Sale } from`, `export { type Sale } from`, `export type * from` and `export type * as api from`.

At declaration collection, use the declaration kind. At re-export traversal, use the identity's value-space mark. A type-only edge supplies no value from which to walk members. Type-space must win when collectors share a unit, independently of declaration order.

A declaring-module type-only export changes that file's inventory: file rules stop asking for the withheld member and tags on it are refused. A type-only re-export changes reference reachability alone; the declaring file still selects the member and accepts its tags.

A withheld member, or a scope emptied by withholding, stops resolving in both cases. Changing the declaring inventory can change a review fingerprint; a re-export projection alone leaves an addressable declaration's fingerprint unchanged.

Classify callable members from their written annotation without a type checker. See through parentheses only. Constructor types and unions containing function types remain properties.

Use one member classification across classes, interfaces and object-shaped type aliases. Get/set pairs materialize no unit in any of those forms. Refuse nameless or computed members without a citable name.

A constructor parameter with a property modifier materializes the same field as a body declaration. The constructor's visibility does not decide the field's visibility. Use TypeScript's property-modifier mask, including `override`, instead of enumerating a partial set.

Document both directions when classification changes. A new callable gains a function obligation and loses its property obligation; a property-only claim over callables can select no host and deactivate silently. The constructor itself hosts no unit, but its withdrawal tag still cascades to the units it declares.

The unit key contains address, symbol kind and qualified name, without the member's declaring container. Two accepted TypeScript shapes remain unresolved limitations:

- `interface I { charge: () => void }` merged with `interface I { charge: Handler }` can split one member into function and property units at one address. A reference selecting both kinds reports ambiguity; these rules cannot infer that the annotations denote the same type.
- `interface ISale { settle: () => void }` merged with `namespace ISale { export const settle = (): void => {} }` can fold two members in different spaces into one unit. An object-shaped type alias can fold similarly. The fold silently reduces the denominator and can let withdrawal of one member suppress the other's public host.

Resolve splitting and folding together at the address-collision owner. A member-collector-only index cannot see namespace members, and choosing one kind for a fold also decides whether another same-named member joins it. Fixing only the reported ambiguity leaves the silent collision unresolved.

A type-only alias projects public namespaces, interfaces, type aliases, classes and members of interfaces or object-shaped type aliases without a class merge, including callables. It withholds namespace data, namespace functions and all class members as value-space.

Materialize no namespace members when that namespace merges with a same-named function. The whole namespace is the function's static machinery, including `get.path`, `get.METADATA` and `get.Output`. A per-kind exclusion would make that machinery public under another selector and could create an aggregate scope ambiguous with the function unit.

Keep namespace members in interface and class merges: they are authored type-family or class companion contracts. A `const` or `let` cannot merge with a namespace; TypeScript rejects the shape with `TS2451`.

Re-exports decide reachability, never identity. Match an aliased export by the public name its module exposes, not its local binding. A type-only edge retains the address while narrowing what it carries to type-space.

For a narrowed `package` reference, matched modules decide membership and the package declaration entry decides addresses. A matched module must not become the address root: it would shorten `functional.health.get` to `get` while import links still resolve through the package entry. Report a unit that the entry does not publish as an empty population; it has no writable public address.

Build addresses from identity segments. Record the module-and-address pair, because an address is legal in the module publishing it and another module may publish the same declaration.

Use declaration hierarchy for containment, not address prefixes. A type and callable may share a public name without either owning the other.

Preserve both function and property host kinds on a mixed variable statement. TypeScript attaches its leading JSDoc to the shared wrapper; choosing one kind makes the other selector spuriously out of scope.

## Evaluation

Evaluate the complete configured graph once per Program, answering these questions separately:

- **Resolution:** does each declaration target resolve to exactly one selected unit or structural ancestor?
- **Host eligibility:** does an `@evidence` host have a symbol kind selected by its claim, or does `@evidenceExclude` occupy an eligible carrier in a matching claim file?
- **Coverage:** does each selected reference unit have an acknowledgment in this claim satisfying that reference's policies?

Keep claim and reference state separate. Satisfying one obligation supplies no coverage to another, even for the same physical target.

A declaration host may state one resolved evidence scope once. Report one duplicate or conflict per later overlapping scope, not one per descendant.

## Reference Policies

Keep constraints local to each reference-array element, including identical or overlapping references.

Refuse an exclusion per reference. Report one declaration/reference diagnostic, supply no coverage to that reference and retain its missing positive coverage. Another reference permitting exclusions may still consume the same declaration.

`singleEvidencePerSymbol` counts reference-unit identities reached by `@evidence`, not tags, positions or exclusions. A population without units supplies no cardinality finding.

Report exactly one review state: missing review, missing fingerprint or stale fingerprint. Each repair subsumes the next. Include the expected fingerprint in every state because the hint API publishes only in a cycle with no rule findings.

A fingerprint belongs to the cited address and its structural subtree, not a reference's selected coverage set. One tag carries one token, so overlapping references must not demand different fingerprints for one address. Restricting acknowledgment coverage does not narrow that digest.

For TypeScript, hash declaring identities and original inventories, including the file-bearing unit ID and original structural subtree. Public aliases and type-only reachability are projections for resolution and coverage. Rebinding an address to another declaration must expire its review.

Exclude every tag-capable position before hashing: HTML comments in Markdown and documentation blocks in TypeScript, including nested property blocks. Normalize line endings and trim trailing whitespace. Writing a review must not change its own fingerprint, and CRLF/LF checkout differences must not expire it.

Preserve the artifact's content boundary. A Markdown heading's own region excludes its subsections. A TypeScript declaration text includes its nested members, so changing one changes its own digest and every enclosing digest.

A withdrawn member's body remains inside an enclosing TypeScript declaration's text and can expire that declaration's review. The withdrawn unit itself contributes only its withdrawal tag to composition. Do not assume a unit's own digest is independent of its subtree.

Every reference kind may require reviews. Compute a per-unit digest where that artifact's content is understood. A whole-source loader digest is a cache key, not a substitute: using it for every unit would expire unrelated reviews on every source regeneration.

Preserve loader failures and derive no cardinality from a partial denominator. An unreadable population base is a loader failure even when its globs select nothing.

Read a linked base through links at every path component. Resolve a TypeScript source and its configured base through the same physical-path rule before comparing them. A link chain the resolver stops following is a failure, never a healthy empty population.

A healthy empty population is a complete denominator of zero. Do not add per-host cardinality findings: the materializer already reports emptiness, and asking each host to cite nonexistent units duplicates an impossible repair. Report the cause once at its owner.

### Checklists

Treat `checklist` as a per-host obligation rather than a fifth cardinality option. Key its duplicates and conflicts per host. Refuse the two incompatible cardinality options at decode; a singleton can satisfy a contradictory combination accidentally.

Report one diagnostic per host listing its unacknowledged targets, never one per host/item pair.

Require a positive checklist target to select an item, and answer only that item without its descendants. The default Markdown selector selects the file itself as an item; a legal file citation must still leave its headings owed. A selected heading stays citable even if it also contains items. Refuse an unselected aggregate and do not also report its descendants missing.

An exclusion retains its subtree cascade: deciding that none of a scope applies is one reviewed answer. Ordinary references also retain their cascade; only positive checklist citations answer one item.

An acknowledgment answers for its own selected host only. If no selected host consumes it, report it once no sibling obligation consumes it. Preserve ordinary reference exclusions and overlapping claims that legitimately consume the same tag; carrier eligibility is wider than checklist host eligibility.

Do not spread a hostless tag over the claim as a gathered exclusion. An anchorless Markdown heading or whitespace-named path must not silently discharge every item for every host.

An empty checklist population passes because no host owes an item. While a selected host exists, its findings replace population-wide coverage findings. Without one, retain the population-wide diagnostic, even though `activeGraphConfig` currently deactivates hostless claims.

A checklist reference with `noEvidenceExclude` is exempt from the `evidenceExcludeCarriers` refusal: it accepts no exclusions for those globs to confine.

Refuse non-Markdown checklists at decode. Suppress that additional refusal when the reference kind itself failed to decode, consistently with the foreign-TypeScript guard.

Keep every positive completion target. At an exclusion trigger, omit a target only if every reference selecting it refuses exclusions. The hint API has no cursor or claim context, so cardinality remains an evaluation diagnostic rather than a completion filter.

## Exclusions

Carrier eligibility is wider than ownership evidence but stays within the claim's file population.

- TypeScript exclusions may occupy supported public exports in matching claim files even when `symbol` selects another host kind. Unexported and unsupported declarations remain ineligible.
- Prisma exclusions may occupy selected model or field hosts, or unattached top-level `///` runs in matching claim files. Those unattached runs never accept `@evidence`.
- Markdown and Swagger hosts retain their selected-symbol behavior.

Never auto-exclude, auto-retarget or delete an artifact or citation to make a graph green. Authors own repairs; diagnostics must name the repair path.

## Diagnostic Messages

State the problem and its repair, naming the claim, reference, target, source location and supported action. Prefer one precise diagnostic to repeated descendant findings.

Include a code repair when applicable. Missing acknowledgments can reflect missing implementation, unresolved targets can reflect an invalid host, and missing reviews can reflect failed checks. A list of tags alone hides those alternatives.

Where an untrue tag could clear a diagnostic, end it with `untrueTagWarning`, or `untrueReviewWarning` for the two review tags. Explain that a tag written to pass can remove the error while leaving the problem; motive matters even if that tag happens to be true.

Omit that warning when the only cheap response is deleting something the graph will report elsewhere.

## Identity Rules

- Targets are exact tokens. Heading identity uses generated or explicit anchors; prose is free.
- Case-insensitive comparison may improve a diagnostic but never decides equality.
- Normalize separators only in Markdown targets, never TypeScript literal names.
- Uppercase Swagger methods but preserve Swagger path case. `POST:/members` and `POST:/Members` differ.
- Preserve the `prisma:` prefix and omit file paths. A Prisma `Sale` must not compete with a TypeScript `Sale` in the shared address map.
- Keep qualified TypeScript segments encoded so a literal dot does not collapse into qualification.
- Report a merged identity at its first declaration by source position, not declaration kind. A type-only namespace may precede its class; `TS2434` forbids only an instantiated namespace before a class, and ambient namespaces may precede it too.
- Accept citations on any declaration of a merged identity. Placement changes neither resolution nor coverage.
- Let the unit model decide supported hosts. An enum has no host, so tags on it are unsupported and `evidence/documented` asks nothing of it. `evidence/singular` still counts it as an identity in the public surface.
