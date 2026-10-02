import { hostDeclaresPolling } from "../tracker/hostDeclaresPolling";
import { TRANSFORM_CACHE_POLLING } from "./TRANSFORM_CACHE_POLLING";
import type { TtscTransformCache } from "./TtscTransformCache";

/**
 * Whether a generation captured for `cache` may let native notifications stand
 * in for re-reading its inputs.
 *
 * Neither the host nor the process environment may have declared polling
 * (samchon/ttsc#1395). Otherwise the generation opens no retained watcher and
 * validates each delivery by metadata and content, the path a generation whose
 * watcher failed already takes.
 *
 * @evidence contracts/common.md#principled-implementation Notification trust requires a cache and no polling declaration from either the cache's host or process environment.
 * @evidence contracts/common.md#clear-and-simple-design One predicate combines the two policy owners; tracker capability and actual notification settlement remain separate proof requirements.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A false predicate selects real metadata/content proof rather than accepting silent watchers under polling.
 * @evidence contracts/common.md#meaningful-documentation The comment explains the two polling declarations and the recorded-state path used when trust is unavailable.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retains nothing.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Three constant-time reads.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Re-evaluated per delivery because a host or the environment can change its polling declaration; nothing is shared.
 */
export function transformCacheTrustsNotifications(
  cache: TtscTransformCache | undefined,
): boolean {
  return (
    cache !== undefined &&
    !TRANSFORM_CACHE_POLLING.has(cache) &&
    !hostDeclaresPolling()
  );
}
