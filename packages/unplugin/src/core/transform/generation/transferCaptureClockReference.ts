import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { TRANSFORM_CLOCK_REFERENCE_DIRECTORIES } from "../clock/TRANSFORM_CLOCK_REFERENCE_DIRECTORIES";

/**
 * Publish the successfully cleaned capture's owned clock storage to its owner.
 *
 * Capture calls this only after local cleanup succeeds and a generation exists.
 * An unavailable directory registers nothing. The association lets validation
 * refresh the same owned probe and lets generation disposal detach and remove
 * it; registration itself proves neither a clock stamp nor native acquisition.
 *
 * The caller transfers a fresh generation and its owned reference directory.
 * This operation does not replace or dispose an earlier generation's storage.
 *
 * @evidence contracts/common.md#principled-implementation Associates available caller-owned reference storage with the exact returned generation, after capture's cleanup gate. Missing storage remains unavailable rather than receiving a fabricated path or timestamp.
 * @evidence contracts/common.md#clear-and-simple-design One ownership publication connects capture to existing validation and disposal consumers; minting, proof qualification and storage removal remain their separate responsibilities.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Performs the actual generation association used by production, without a test-only channel, injected compiler result or synthetic native release/acquisition receipt.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the successful-cleanup precondition, fresh ownership assumption, missing-directory behavior and limits of registration authority.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Publishes an opaque directory coordinate supplied by its native storage owner; no path grammar, case rule, filesystem operation or OS capability is interpreted here.
 * @evidenceExclude contracts/performance.md#efficient-algorithms One optional WeakMap assignment adds no scan, traversal or input processing strategy.
 * @evidence contracts/performance.md#reuse-equivalent-work Existing validation consumers find this generation's same owned storage instead of inventing another probe location. They still mint and qualify fresh observations; sharing the directory grants no authority to reuse an old timestamp.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The weak generation association holds one directory spelling per transferred owner without extending that owner's reachability. disposeCachedTransform detaches the association and attempts native removal; garbage collection alone does not remove storage, and this publication neither acquires a handle nor certifies later release.
 */
export function transferCaptureClockReference(
  /** Fresh returned generation whose local cleanup has completed successfully. */
  captured: TtscCachedProjectTransform,

  /** Owned reference storage, or unavailable storage leaving no association. */
  referenceDirectory: string | undefined,
): void {
  if (referenceDirectory !== undefined) {
    TRANSFORM_CLOCK_REFERENCE_DIRECTORIES.set(captured, referenceDirectory);
  }
}
