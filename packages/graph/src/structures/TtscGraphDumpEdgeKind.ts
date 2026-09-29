/**
 * Relationship kinds the native Go dump producer can write.
 *
 * Memory-only containment and trace dispatch are absent because the native
 * producer does not emit either relation.
 *
 * @evidence contracts/common.md#principled-implementation Literal variants describe only relationships emitted by the native wire producer.
 * @evidence contracts/common.md#clear-and-simple-design A separate wire union keeps validation independent of memory-derived relation additions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Memory containment and inferred dispatch cannot be accepted as native compiler output.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains why the wire vocabulary excludes the two later-layer relationships.
 */
export type TtscGraphDumpEdgeKind =
  | "exports"
  | "calls"
  | "accesses"
  | "instantiates"
  | "type_ref"
  | "doc_ref"
  | "extends"
  | "implements"
  | "overrides"
  | "renders";
