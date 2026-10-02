/**
 * Cancellation policy for `loadTypiaRuntimePack`.
 *
 * @evidence contracts/common.md#principled-implementation Optional AbortSignal carries the caller's cancellation request without imposing a fabricated network deadline.
 * @evidence contracts/common.md#clear-and-simple-design Runtime URL is the loader's direct argument; this record contains only cancellation policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Shared cancellation is an explicit supported behavior, not a hidden timeout or global replacement.
 * @evidence contracts/common.md#meaningful-documentation The member comment states that cancellation ends the shared attempt, following native documentation and tag separation rules.
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition declares a shape and retains no state or handle.
  * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition declares a shape and performs no computation.
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition declares a shape and shares no computation.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation A type definition owns no native filesystem, path or process decision.
 */
export interface ILoadTypiaRuntimePackOptions {
  /** Cancel the shared in-flight load. */
  signal?: AbortSignal;
}
