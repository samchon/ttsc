import { TRANSFORM_CACHE_EPOCHS } from "./TRANSFORM_CACHE_EPOCHS";
import type { TtscTransformCache } from "./TtscTransformCache";
import { withdrawTtscTransformGenerations } from "./withdrawTtscTransformGenerations";

/**
 * Discard every generation, dispose its watchers, and return the cache to
 * persistent validation mode.
 *
 * This is the unconditional lifecycle boundary, and it is distinct from
 * `beginTtscTransformBuild`: a pass ending is not a reason to throw a proven
 * compile away, while a session ending is.
 *
 * @evidence contracts/common.md#principled-implementation Reset immediately removes cached promises and the epoch, while fulfilled pending generations subsequently release their owned resources.
 * @evidence contracts/common.md#clear-and-simple-design The exported lifecycle boundary delegates entry cleanup to one helper and separately removes the delivery-pass declaration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Reset is an explicit ownership boundary, not a per-module recompilation workaround or patched Promise behavior.
 * @evidence contracts/common.md#meaningful-documentation The comment explains why session reset differs from opening the next delivery pass.
 * @evidence contracts/performance.md#efficient-algorithms Reset traverses cached promises once, clears membership immediately, and schedules fulfilled generation cleanup without serially awaiting compiles.
 * @evidence contracts/performance.md#reuse-equivalent-work The explicit reset boundary preserves reuse across ordinary pass openings and shares the standard generation disposer.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Entries and epoch are removed immediately; generations finishing later still release their watchers and probes through scheduled disposal.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 */
export function resetTtscTransformCache(cache: TtscTransformCache): void {
  withdrawTtscTransformGenerations(cache);
  TRANSFORM_CACHE_EPOCHS.delete(cache);
}
