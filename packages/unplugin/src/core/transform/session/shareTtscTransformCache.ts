import type { TtscTransformCache } from "../cache/TtscTransformCache";
import { TRANSFORM_CACHE_SESSIONS } from "./TRANSFORM_CACHE_SESSIONS";

/**
 * Let `cache` share whole-project compiles with the other processes of a pooled
 * host session through `session` (samchon/ttsc#1390).
 *
 * A pooled adapter, such as the Turbopack loader or the Metro transformer,
 * calls this once per worker with {@link readTtscTransformSession}'s answer. The
 * cache then takes a generation that another worker of the session compiled
 * from the same project state, once it has proven that state itself, instead of
 * compiling the whole project again. `undefined` withdraws the declaration.
 *
 * @param cache The worker's transform cache.
 * @param session The session's shared compile store, or `undefined`.
 */
export function shareTtscTransformCache(
  cache: TtscTransformCache,
  session: string | undefined,
): void {
  if (session === undefined) TRANSFORM_CACHE_SESSIONS.delete(cache);
  else TRANSFORM_CACHE_SESSIONS.set(cache, session);
}
