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
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
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
