import type { ITtscTypeInfo } from "./ITtscTypeInfo";

/**
 * Payload inside `ITtscResult.result` for `getTypeAtPosition`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A nullable type mirrors the native optional semantic result, separately from
 *   the error code carried by the enclosing request envelope.
 * @evidence contracts/common.md#clear-and-simple-design
 *   The nullable type field carries the semantic result without conflating it
 *   with request failure or adding a parallel state discriminator.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No universal any/error type is fabricated for positions without type semantics.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc identifies the endpoint and meaningful null state, following
 *   the documentation skill's guidance for consumer-facing context.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscTypeAtPositionResult is a data interface and acquires no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscTypeAtPositionResult is a data interface and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscTypeAtPositionResult is a data interface and coordinates no shared or repeated computation.
 */
export interface ITtscTypeAtPositionResult {
  /** `null` when no touching token has a type. */
  type: ITtscTypeInfo | null;
}
