import { TRANSFORM_CACHE_EPOCHS } from "./TRANSFORM_CACHE_EPOCHS";
import type { TtscTransformCache } from "./TtscTransformCache";
import { withdrawTtscTransformGenerations } from "./withdrawTtscTransformGenerations";

/**
 * Discard every generation, schedule its resource cleanup and return the cache
 * to persistent validation mode.
 *
 * This is the unconditional lifecycle boundary, and it is distinct from
 * `beginTtscTransformBuild`: a pass ending is not a reason to throw a proven
 * compile away, while a session ending is.
 *
 * @evidence contracts/common.md#principled-implementation Reset immediately removes cached promises and the epoch, while fulfilled pending generations subsequently attempt their owned resource cleanup.
 * @evidence contracts/common.md#clear-and-simple-design The exported lifecycle boundary delegates entry cleanup to one helper and separately removes the delivery-pass declaration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Reset is an explicit ownership boundary, not a per-module recompilation workaround or patched Promise behavior.
 * @evidence contracts/common.md#meaningful-documentation The comment explains why session reset differs from opening the next delivery pass.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Withdrawal snapshots N promises then schedules N reactions with O(N)
 *   temporary references; epoch deletion is fixed work. Fulfilled reactions
 *   additionally perform generation-owned watcher/probe cleanup, without
 *   serially awaiting compiles or scanning project files here.
 * @evidence contracts/performance.md#reuse-equivalent-work The explicit reset boundary preserves reuse across ordinary pass openings and shares the standard generation disposer.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Entries and epoch are removed immediately, unlike volatile withdrawal.
 *   Fulfilled generations transfer their handles/probes to disposal attempts;
 *   pending compiles have no cancellation deadline and failed native cleanup
 *   can leave underlying resources. No new lifecycle state is retained here.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Reset delegates cleanup to each generation's actual native close and probe
 *   owners, preserving their observing capability rather than assuming every
 *   platform releases resources identically. Epoch deletion is separate scalar
 *   lifecycle state and does not normalize filesystem keys.
 */
export function resetTtscTransformCache(
  /** Cache ending its generation and declared delivery-pass ownership. */
  cache: TtscTransformCache,
): void {
  withdrawTtscTransformGenerations(cache);
  TRANSFORM_CACHE_EPOCHS.delete(cache);
}
