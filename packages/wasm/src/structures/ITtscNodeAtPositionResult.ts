import type { ITtscNodeInfo } from "./ITtscNodeInfo";

/**
 * Payload inside `ITtscResult.result` for `getNodeAtPosition`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A nullable node mirrors the native pointer's JSON encoding and distinguishes
 *   a successful query with no token from an error envelope.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One nullable node field expresses a token query result; node details and
 *   transport errors stay in their existing separate representations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No fabricated node stands in for an absent token; absence remains explicit.
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc names the endpoint and null meaning, following the documentation
 *   skill's requirement to explain optional or absent state.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscNodeAtPositionResult is a data interface and acquires no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscNodeAtPositionResult is a data interface and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscNodeAtPositionResult is a data interface and coordinates no shared or repeated computation.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscNodeAtPositionResult is a data interface and performs no native filesystem, path or process operation.
 */
export interface ITtscNodeAtPositionResult {
  /** `null` when no syntax token touches the position. */
  node: ITtscNodeInfo | null;
}
