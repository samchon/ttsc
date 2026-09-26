import { TRANSFORM_CACHE_POLLING } from "./TRANSFORM_CACHE_POLLING";
import type { TtscTransformCache } from "./TtscTransformCache";

/**
 * Record whether the host that owns `cache` watches by polling.
 *
 * Called whenever the host's configuration resolves, since a plugin instance
 * can be reused across servers with different watch options. A generation the
 * cache captures afterwards opens no retained watcher under polling. One
 * captured before, with native watchers, gives them up at its next delivery and
 * is proven from its recorded state instead (samchon/ttsc#1542).
 *
 * @param cache The persistent transform cache.
 * @param polling Whether the host polls, typically from `hostDeclaresPolling`.
 */
export function declareTtscTransformPolling(
  cache: TtscTransformCache,
  polling: boolean,
): void {
  if (polling) TRANSFORM_CACHE_POLLING.add(cache);
  else TRANSFORM_CACHE_POLLING.delete(cache);
}
