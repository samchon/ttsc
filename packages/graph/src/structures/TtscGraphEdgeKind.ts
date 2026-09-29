/**
 * The relationship a directed edge encodes between two {@link ITtscGraphNode}s.
 *
 * Structural `exports` edges come from the native declaration pass, while the
 * TypeScript memory layer synthesizes `contains` ownership. Value and type
 * edges (`calls`, `accesses`, `instantiates`, `type_ref`, `extends`,
 * `implements`, `overrides`, `renders`) are resolved by the checker — `renders`
 * is a JSX component use. Decorators are facts on their target node, not
 * edges.
 *
 * `doc_ref` is a declaration's own documentation naming a symbol through an
 * inline link. The checker resolves that name and counts it as a use, so it is
 * a compiler fact like the rest; it is its own kind rather than a `type_ref`
 * because a link is not a type position and may name a function. The tag around
 * a link decides nothing — one under `@evidence`, under `@see`, and in ordinary
 * prose are one relation.
 *
 * `dispatches` is the runtime counterpart of `overrides`/`implements`: the
 * checker resolves a call to the declaration it names, and where that
 * declaration is abstract or an interface member, the code that runs is its
 * implementation. It carries the implementation's declaration span, and a
 * traversal that follows what executes emits it in place of the dead end. It is
 * trace-only and never appears in a native dump.
 *
 * @evidence contracts/common.md#principled-implementation The union distinguishes compiler relationships, memory containment and trace-only dispatch, each with a separate semantic role.
 * @evidence contracts/common.md#clear-and-simple-design One shared relation vocabulary keeps producers and projections aligned without a second generic relation taxonomy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Documentation links remain compiler uses; dispatch follows actual implementation relations rather than guessing runtime calls.
 * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs explain structural, documentation and dispatch relationships and their producer boundaries.
 */
export type TtscGraphEdgeKind =
  | "contains"
  | "exports"
  | "calls"
  | "accesses"
  | "instantiates"
  | "type_ref"
  | "doc_ref"
  | "extends"
  | "implements"
  | "overrides"
  | "dispatches"
  | "renders";
