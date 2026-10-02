/**
 * One failed proof that prevents a whole-project transform becoming reusable.
 * Domain identifies the evidence family, while kind remains open to that
 * producer's failure classes and optional path/detail supply diagnostic context.
 *
 * @evidence contracts/common.md#principled-implementation The closed evidence-family union distinguishes project, graph, host and external failures; an open kind preserves producer-specific causes without conflating them with domain.
 * @evidence contracts/common.md#clear-and-simple-design One witness carries classification and optional attribution; bounded aggregation and rendering remain separate responsibilities.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Witnesses report actual producer failures rather than expected test results or a boolean that hides which proof was absent.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains classification and optional context, and separated members document lexical path representation and producer detail.
 * @evidence contracts/portability.md#os-neutral-implementation Optional path carries the producer's absolute native lexical spelling; the diagnostic renderer owns native containment and display conversion, without treating this field as a portable identity key.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscGenerationProofFailure only declares a shape; it has no computation
 *   at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscGenerationProofFailure only declares a shape; it has no work to reuse
 *   at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscGenerationProofFailure only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export interface TtscGenerationProofFailure {
  /**
   * Which evidence family failed: the project walk, out-of-walk inputs, the
   * compiler graph, or host inputs.
   */
  domain: "external" | "graph" | "host" | "project";

  /** Machine-readable failure class printed verbatim in terminal diagnostics. */
  kind: string;

  /** Optional producer detail, such as the native compiler observation failure. */
  detail?: string;

  /** Absolute lexical spelling of the input or directory that failed proof. */
  path?: string;
}
