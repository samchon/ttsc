import type { ITtscNodeInfo } from "./ITtscNodeInfo";

/**
 * Payload inside `ITtscResult.result` for `getNodeAtPosition`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A nullable node mirrors the native pointer's JSON encoding and distinguishes
 *   a successful query with no token from an error envelope.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No fabricated node stands in for an absent token; absence remains explicit.
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc names the endpoint and null meaning, following the documentation
 *   skill's requirement to explain optional or absent state.
 */
export interface ITtscNodeAtPositionResult {
  /** `null` when no syntax token touches the position. */
  node: ITtscNodeInfo | null;
}
