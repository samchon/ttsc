import { TRANSFORM_CLOCK_REFERENCE_DIRECTORIES } from "../clock/TRANSFORM_CLOCK_REFERENCE_DIRECTORIES";
import { disposeFilesystemClockReference } from "../clock/disposeFilesystemClockReference";
import type { TtscCachedProjectTransform } from "./TtscCachedProjectTransform";

/**
 * Detach one generation's watchers and attempt its owned probe cleanup.
 *
 * Each independent tracker is attempted after every field and the clock
 * association are detached. Repeated disposal then has no retained handle to
 * close. A failed native close/removal is tolerated, not certified as released.
 *
 * @evidence contracts/common.md#principled-implementation Removing handles from the generation before closing makes repeated disposal harmless; each independent tracker is attempted even if another close throws.
 * @evidence contracts/common.md#clear-and-simple-design The disposer owns the three tracker fields and clock reference only, leaving cache membership and lifecycle scheduling to their callers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Catching a close failure preserves independent cleanup, without turning a failed compile or validation into a successful result.
 * @evidence contracts/common.md#meaningful-documentation The native comment identifies generation ownership, and the internal explanation states why scheduled cleanup must not leave rejected promises.
 * @evidence contracts/performance.md#efficient-algorithms Disposal visits three trackers and one clock reference; delegated tracker cleanup closes W retained watchers in O(W) work and temporary references, without rescanning project files.
 * @evidence contracts/performance.md#reuse-equivalent-work One disposer handles eviction and complete reset, avoiding divergent lifetime rules.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Handles and the clock association detach before cleanup, and every
 *   independent resource is attempted. Repeated disposal owns no remaining
 *   handle; failed native close or owned probe/directory removal can leave an
 *   underlying resource. No retry task or failure history is retained here.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral disposal invokes each native close capability and the shared owned-probe remover without assuming watchers or busy-file removal behave identically across OSes.
 */
export function disposeCachedTransform(
  /** Generation whose retained resource fields transfer to cleanup attempts. */
  cached: TtscCachedProjectTransform,
): void {
  const trackers = [
    cached.projectMutationTracker,
    cached.hostInputMutationTracker,
    cached.candidateMutationTracker,
  ];
  cached.projectMutationTracker = undefined;
  cached.hostInputMutationTracker = undefined;
  cached.candidateMutationTracker = undefined;
  const clockReferenceDirectory =
    TRANSFORM_CLOCK_REFERENCE_DIRECTORIES.get(cached);
  TRANSFORM_CLOCK_REFERENCE_DIRECTORIES.delete(cached);
  for (const tracker of trackers) {
    try {
      tracker?.close();
    } catch {
      // Disposal is scheduled behind fulfilled generation Promises, so it has
      // no caller that can recover from a close failure. Keep releasing every
      // independent resource and leave no rejected cleanup Promise behind.
    }
  }
  if (clockReferenceDirectory !== undefined) {
    disposeFilesystemClockReference(clockReferenceDirectory);
  }
}
