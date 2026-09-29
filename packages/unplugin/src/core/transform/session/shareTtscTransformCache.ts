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
 *
 * @evidence contracts/common.md#principled-implementation Cache identity keys the session declaration, and undefined removes it, so sharing applies only to the declared worker cache.
 * @evidence contracts/common.md#clear-and-simple-design One WeakMap update declares the capability; actual claiming and adoption proof remain in their owning operations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The declaration does not treat cached output as proven or patch the cache's methods.
 * @evidence contracts/common.md#meaningful-documentation The native comment explains pooled-worker usage, later proof, and explicit withdrawal rather than suggesting immediate adoption.
 */
export function shareTtscTransformCache(
  cache: TtscTransformCache,
  session: string | undefined,
): void {
  if (session === undefined) TRANSFORM_CACHE_SESSIONS.delete(cache);
  else TRANSFORM_CACHE_SESSIONS.set(cache, session);
}
