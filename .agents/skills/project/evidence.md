# Evidence Graph

The [Evidence Tags](../../../website/src/content/docs/evidence/tags.mdx) and [Configuration](../../../website/src/content/docs/evidence/claims.mdx) guides own the user-facing semantics; read them first. This file holds the implementation invariants behind them. The Go rule API belongs to `packages/lint/README.md`.

## Contents

- Tags
- Units And Hierarchy
- Swagger, Prisma, TypeScript
- Evaluation, Reference Policies, Checklists
- Exclusions, Diagnostics, Identity

## Tags

- A review is an annotation on a citation, typed outside `tagKind`: it never enters acknowledgment maps, coverage, `uniqueEvidence`, `singleEvidencePerSymbol`, or exclusion conflicts.
- `declarationLine` keeps its whitespace boundary after `@evidence`, which separates `@evidenceReview` and `@evidenceExclude`. Check a fingerprint's exact length as well as its `#`, since an anchor such as `#req-search-policies` also starts with `#`.
- Every consumer asking whether a line carries a tag recognizes the H2-H4 heading form as well as the one-line form: the parsers, unreadable-comment reporting, Prisma misplaced-comment checks, and the Markdown prose reporter. `openAnnotation` covers the forms that open an annotation; the Markdown reporter also reports tag-shaped H1, H5, and H6 titles, which open none.
- A heading section takes its target from the heading alone. Prose below may give the reason, never the target, and an unterminated link cannot borrow a brace from it. A one-line annotation keeps its cross-line target split.
- A target's kind comes from its token, independent of reference context: a path is one token, and only a code target may use braces as a boundary. A citation-only import stays unused to `@typescript-eslint/no-unused-vars`.
- A file-qualified target resolves its path from the citing file and its accessor from that module's public exports. Keep import-scoped inline links and reject bare cross-module symbol lookup.
- An explicit TypeScript reference `root` opts into disk loading: its `files` select entry modules under it, re-export traversal stays inside it, and active Program snapshots win over disk. Declare that directory through `ProjectInputs` before loading, so creation, deletion, repair, and re-export changes refresh watch and editor diagnostics. Without `root` or `package`, entry selection is Program-only. A failed lookup never supplies coverage.
- Never add a rule that guesses whether a reason is sincere; it rewards filler.

## Units And Hierarchy

- Keep selected obligations separate from resolvable scopes, adding only real ancestors to the scope closure; making unrelated units resolvable creates same-name ambiguity.
- Store explicit parent unit IDs at materialization; never infer TypeScript ancestry from dotted names.
- A withdrawn unit stays, with its withdrawal tag, so a citation of it names the withdrawal. Reconcile withdrawal after materialization across every declaration of an identity: a tag on any declaration withdraws the whole identity, overloads and merged interfaces included.
- A host position is a node-and-symbol-kind pair, released only when every identity of that kind reaching it is withdrawn, so withdrawing `price` in `export var price: number, live: number` leaves `live` citable.
- Record every host position among its unit's nodes, including module- and namespace-scope declarators, and read an inner declarator's own withdrawal tags as well as its container's. The statement wrapper and inner declarator are positions of one variable, and a review on either answers a citation on the other. Changing these associations can expire or newly satisfy reviews; document both.
- A variable owns its statement wrapper as a position, but its content is its own declarator (name, annotation, initializer), so siblings stay out of its fingerprint. Destructuring leaves share the declarator and initializer, and a binding identifier's leading trivia is never content. Narrowing a variable digest also changes enclosing fingerprints; document those expiries.
- Report a unit's position inside its declaration's own name.
- Read tags only from parser-attached documentation blocks. Binding elements have none, so attach nothing to a block inside a destructuring pattern.
- Report unsupported tags in `//` comments, runs of three or four slashes, and commented-out code, judged per line, offering both repairs: move the citation into a documentation block, or remove it. Confine this to the declared claim populations, inactive claims included; files outside every claim glob, dependencies included, are out of scope, and package-reference globs confer no claim ownership.
- Report a scan problem to every population reading that file, against that population's own symbol set; a file-level problem uses the wildcard symbol.
- A visible Markdown annotation heading is metadata owned by the nearest shallower outline heading, or the file. Its section materializes no unit, never parents later headings, and is excluded from every digest, as are comments inside it. Decide annotation headings from the outline's own lexical heading view, and report a tag-shaped heading that opens no section as unreadable.
- Judge claim scan problems before activation, and reference scan problems only after it, because inactive claims run no reference loaders.

## Swagger

- One `ITtscEvidenceGraphSwaggerReference` owns one document through `file`, with no `symbol` selector; every operation under `paths` is selected.
- Normalize with `@typia/utils` to `OpenApi.IDocument` first, and return each operation's identity and digest from that bridge.
- Resolve every `$ref` into `components.schemas` before hashing, following a self-reference once.
- An operation is a unit with no interior tags or subtree. A remote document's fingerprints describe its one fetch.

## Prisma

- Hash each model and member from the parser's declaration without its documentation comment. A model's digest excludes its fields, which are separate units.
- Read types, attributes, and arguments from parser values: `@@unique` and `@@map` change the model digest, and `@@index` changes none. A parser upgrade may change every Prisma fingerprint.
- The composite source digest is a cache key over the ordered files and their paths. Per-unit digests exclude paths, so moving a model keeps its citation.
- Compose the schema from physical files, deduplicating with `os.SameFile`, and share units across inventories of one physical file.
- Views are `model` units; enums, composite types, and indexes are not units.
- Locations come from a native scan that never adds, removes, or reclassifies a unit.
- Join member addresses with a dot. Accept `///` and `/* */` documentation, discard `//`, report `//// @evidence` like a `//` citation, and let an intervening `//` line continue a documentation run.

## TypeScript

- Spell diagnostic locations project-relative when possible, and a configuration's `root` exactly as declared, normalized but unresolved.
- A class is a unit with members beneath it. An interface merged with a class contributes `prototype` members and a merged namespace contributes static members, sharing the member's address and identity.
- Visibility comes from `private` and `protected` alone; `abstract` and `override` members stay selected.
- A type-only alias exposes a class name but no class members, and withholds merged interface members with them; keep this guard on the merged identity. It applies to declaring-file export lists, inline `export { type X }`, type-only projections, and every type-only re-export: `export type { X } from`, `export { type X } from`, `export type * from`, and `export type * as ns from`.
- Collection uses the declaration kind and re-export traversal the identity's value-space mark; type space wins regardless of collector order.
- A declaring-module type-only export changes that file's inventory, so its members are no longer owed and refuse tags. A type-only re-export changes only reachability. A withheld member, or a scope emptied by withholding, stops resolving, and only a declaring-inventory change can change a fingerprint.
- Classify callable members from the written annotation, seeing through parentheses only; constructor types and unions containing functions stay properties. Use one classification for classes, interfaces, and object-shaped aliases; get/set pairs materialize nothing, and nameless or computed members are refused.
- A constructor parameter property is the same field as a body declaration, its visibility independent of the constructor's, detected with TypeScript's full property-modifier mask including `override`.
- When classification changes, document both directions: a new callable gains a function obligation and loses a property one, and a property-only claim can deactivate silently. A constructor hosts no unit, but its withdrawal cascades to the units it declares.
- The unit key is address, symbol kind, and qualified name. Two limitations remain: merged interfaces annotating one member as `() => void` and `Handler` split it into two kinds, and an interface or object alias merged with a same-named namespace member folds two members into one unit. Fix splitting and folding together at the address-collision owner.
- A type-only alias projects namespaces, interfaces, type aliases, classes, and members of interfaces and object aliases without a class merge, and withholds namespace data, namespace functions, and all class members.
- A namespace merged with a same-named function materializes no members, being the function's static machinery; namespaces merged with interfaces or classes keep theirs.
- Re-exports decide reachability, never identity. Match an aliased export by its exported name, and narrow a type-only edge to type space while keeping the address.
- For a narrowed `package` reference, matched modules decide membership and the package entry decides addresses; a unit the entry does not publish is an empty population.
- Build addresses from identity segments, record the module-and-address pair, and decide containment by declaration hierarchy, not address prefixes.
- A mixed variable statement keeps both function and property host kinds.

## Evaluation

Evaluate the whole configured graph once per Program, answering separately whether each target resolves to exactly one selected unit or ancestor, whether each host is eligible for its claim, and whether each selected reference unit is covered under its policies. Claim and reference state stay separate, and one obligation never covers another. A host states one resolved scope once; report one duplicate per later overlapping scope.

## Reference Policies

- Constraints stay local to each reference element, even identical ones. A refused exclusion gives one diagnostic and no coverage to that reference, and keeps its missing coverage; another reference may still accept it.
- `singleEvidencePerSymbol` counts reference-unit identities reached by `@evidence`; an empty population gives no cardinality finding.
- Report exactly one review state, missing review, missing fingerprint, or stale fingerprint, each with the expected fingerprint.
- A fingerprint belongs to the cited address and its structural subtree, not to a reference's coverage set.
- For TypeScript, hash declaring identities and original inventories; aliases and type-only reachability are projections, and rebinding an address to another declaration expires its review.
- Before hashing, exclude every tag-capable position (Markdown HTML comments, TypeScript documentation blocks including nested property blocks), normalize line endings, and trim trailing whitespace, so writing a review or switching CRLF and LF never expires it.
- A Markdown heading's region excludes its subsections. A TypeScript declaration includes its members, so a member change, a withdrawn member's body included, expires every enclosing digest.
- Compute per-unit digests where the artifact is understood; a whole-source digest is only a cache key.
- Keep loader failures, and derive no cardinality from a partial denominator. An unreadable base is a failure even when it selects nothing. Resolve links at every path component, apply one physical-path rule to a source and its base, and treat an unfollowed link chain as a failure. A healthy empty population is a complete zero, reported once at its owner.

## Checklists

- `checklist` is a per-host obligation, not a cardinality option: key its duplicates per host, and refuse the incompatible cardinality options at decode.
- Report one diagnostic per host listing its unacknowledged targets.
- A positive checklist target answers one selected item without its descendants. The default Markdown selector selects the file as an item, so a file citation leaves its headings owed. Refuse an unselected aggregate without also reporting its descendants.
- An exclusion still cascades over its subtree, and ordinary references keep their cascade.
- An acknowledgment answers only its own selected host. Report it once when no sibling obligation consumes it, keeping legitimate ordinary-reference and overlapping-claim consumers, and never spread a hostless tag over the claim.
- An empty checklist population passes. With a selected host, its findings replace population-wide ones; without one, keep the population-wide diagnostic.
- A `noEvidenceExclude` checklist reference skips the `evidenceExcludeCarriers` refusal. Refuse non-Markdown checklists at decode unless the reference kind already failed. Keep every positive completion target, omitting one at an exclusion trigger only when every selecting reference refuses exclusions; cardinality stays an evaluation diagnostic, not a completion filter.

## Exclusions

- TypeScript exclusions may sit on supported public exports in matching claim files even when `symbol` selects another kind. Prisma exclusions may sit on selected models or fields, or on unattached top-level `///` runs, which never accept `@evidence`. Markdown and Swagger keep their selected-symbol behavior.
- Never auto-exclude, retarget, or delete an artifact or citation to turn the graph green; diagnostics name the author's repair.

## Diagnostics

- State the problem and its repair, naming the claim, reference, target, location, and action, with one diagnostic instead of repeated descendant findings, and a code repair where one applies.
- End a diagnostic that an untrue tag could clear with `untrueTagWarning`, or `untrueReviewWarning` for review tags, unless the only cheap response is deleting something reported elsewhere.

## Identity

- Targets are exact tokens, and headings match by generated or explicit anchors; case-insensitive comparison may only improve a message.
- Normalize separators only in Markdown targets. Uppercase Swagger methods but keep path case. Keep the `prisma:` prefix without file paths. Keep qualified TypeScript segments encoded.
- Report a merged identity at its first declaration by source position, and accept citations on any of its declarations. The unit model decides hosts: an enum hosts nothing, yet `evidence/singular` counts it.
