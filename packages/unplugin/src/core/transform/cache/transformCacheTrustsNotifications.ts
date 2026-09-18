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
