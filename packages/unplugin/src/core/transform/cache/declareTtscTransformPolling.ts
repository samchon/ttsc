import { TRANSFORM_CACHE_POLLING } from "./TRANSFORM_CACHE_POLLING";
import type { TtscTransformCache } from "./TtscTransformCache";

/**
 * Record whether the host that owns `cache` watches by polling.
 *
 * Called whenever the host's configuration resolves, since a plugin instance
 * can be reused across servers with different watch options. A declaration
 * takes effect for the next generation the cache captures; the existing one
 * keeps its own notifications until it is replaced.
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
