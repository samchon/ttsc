import { disposeCachedTransform } from "./disposeCachedTransform";
import type { TtscTransformCache } from "./TtscTransformCache";

/**
 * Withdraw every generation while preserving the host's current delivery pass.
 *
 * Volatile input observations disqualify reuse without ending a one-shot build.
 * Clear membership immediately; pending generations still release their owned
 * trackers and clock probes when they finish.
 *
 * @evidence contracts/common.md#principled-implementation Generation withdrawal clears only cached promises; the host's epoch stays authoritative until its actual terminal lifecycle boundary.
 * @evidence contracts/common.md#clear-and-simple-design One operation shares generation disposal between volatile withdrawal and terminal reset without conflating their lifecycle authority.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Incomplete observation actually withdraws reusable entries; it does not invent a new pass or mark metadata that no owner consumes.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain immediate membership withdrawal and eventual resource release while distinguishing the retained delivery pass.
 * @evidence contracts/performance.md#efficient-algorithms One cache traversal snapshots N promises and clears membership without serially awaiting their compilation.
 * @evidence contracts/performance.md#reuse-equivalent-work Terminal reset and volatile withdrawal share the same generation disposal operation; complete ordinary pass opening retains its existing reuse policy.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Each fulfilled withdrawn promise releases generation-owned trackers and probes through the standard disposer; failed promises require no acquired generation cleanup.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 */
export function withdrawTtscTransformGenerations(cache: TtscTransformCache): void {
  const generations = [...cache.values()];
  cache.clear();
  for (const generation of generations) {
    void generation.then(disposeCachedTransform, () => undefined);
  }
}
