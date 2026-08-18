/**
 * The relationship a directed edge encodes between two {@link ITtscGraphNode}s.
 *
 * Structural `exports` edges come from the native declaration pass, while the
 * TypeScript memory layer synthesizes `contains` ownership. Value and type
 * edges (`calls`, `accesses`, `instantiates`, `type_ref`,
 * `extends`, `implements`, `overrides`, `renders`) are resolved by the checker
 * — `renders` is a JSX component use. Decorators are facts on their target node,
 * not edges.
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
