import { hostDeclaresPolling } from "../tracker/hostDeclaresPolling";
import { TRANSFORM_CACHE_POLLING } from "./TRANSFORM_CACHE_POLLING";
import type { TtscTransformCache } from "./TtscTransformCache";

/**
 * Whether polling policy permits a generation to acquire notification proof.
 *
 * Neither the host nor the process environment may have declared polling
 * (samchon/ttsc#1395). Otherwise the generation opens no retained watcher and
 * validates each delivery by metadata and content, the path a generation whose
 * watcher failed already takes. True is permission, not unchanged-input
 * evidence: coverage, directory identity, event classification and actual
 * backend authority still qualify the generation's trackers.
 *
 * @evidence contracts/common.md#principled-implementation Notification trust requires a cache and no polling declaration from either the cache's host or process environment.
 * @evidence contracts/common.md#clear-and-simple-design One predicate combines the two policy owners; tracker capability and actual notification settlement remain separate proof requirements.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A false predicate selects real metadata/content proof rather than accepting silent watchers under polling.
 * @evidence contracts/common.md#meaningful-documentation The comment explains the two polling declarations and the recorded-state path used when trust is unavailable.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retains nothing.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Absent caches and declared cache polling short-circuit before environment
 *   parsing. Otherwise the host parser reads two named values and may lowercase
 *   Chokidar text or convert and compare Watchpack numeric text; work and
 *   temporary strings scale with the supplied declaration lengths.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Re-evaluated per delivery because a host or the environment can change its polling declaration; nothing is shared.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Native notification admission follows the cache owner's polling declaration
 *   and the existing host environment parser, not an OS or mount-name guess.
 *   A positive policy result adds no capability or alias-free assumption;
 *   actual tracker coverage and backend proof remain with their native owners.
 */
export function transformCacheTrustsNotifications(
  /** Cache owning host polling policy, or absent when no tracker is retained. */
  cache: TtscTransformCache | undefined,
): boolean {
  return (
    cache !== undefined &&
    !TRANSFORM_CACHE_POLLING.has(cache) &&
    !hostDeclaresPolling()
  );
}
