/**
 * The relationship a directed edge encodes between two {@link ITtscGraphNode}s.
 *
 * Structural edges (`contains`, `exports`, `imports`) come from the declaration
 * pass. Value and type edges (`calls`, `accesses`, `instantiates`, `type_ref`,
 * `extends`, `implements`, `overrides`, `renders`) are resolved by the checker
 * — `renders` is a JSX component use. `decorates` carries a decorator fact and
 * `tests` a test-to-subject relationship.
 *
 * Every edge is tagged with a {@link TtscGraphProvenance} and
 * {@link TtscGraphConfidence}, so a consumer can separate checker-resolved fact
 * from heuristic inference regardless of kind.
 */
export type TtscGraphEdgeKind =
  | "contains"
  | "exports"
  | "imports"
  | "calls"
  | "accesses"
  | "instantiates"
  | "type_ref"
  | "extends"
  | "implements"
  | "overrides"
  | "decorates"
  | "renders"
  | "tests";
