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
 * @evidence contracts/common.md#principled-implementation Cache identity keys the session declaration, and undefined removes it, so sharing applies only to the declared worker cache.
 * @evidence contracts/common.md#clear-and-simple-design One WeakMap update declares the capability; actual claiming and adoption proof remain in their owning operations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The declaration does not treat cached output as proven or patch the cache's methods.
 * @evidence contracts/common.md#meaningful-documentation The native comment explains pooled-worker usage, later proof, and explicit withdrawal rather than suggesting immediate adoption.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The association retains one current store-address string per cache without keeping its object key alive. Set replaces the old value and undefined deletes it; address bytes have no cap. Withdrawal releases only this declaration, not native store files or another owner's session lifecycle.
 * @evidence contracts/performance.md#efficient-algorithms One object-keyed WeakMap set or delete changes the association without scanning cache generations or store contents. The address string is retained unchanged rather than parsed or hashed here; this operation performs no native I/O.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This update declares which store a cache may consult. claimSharedCompile owns store claiming, while captureTransformGeneration owns publication adoption proof; storing the address supplies no completed compile or filesystem validity certificate.
 * @evidence contracts/portability.md#os-neutral-implementation The caller supplies the session's native store address, commonly through readTtscTransformSession's absolute-directory check. This boundary preserves that address unchanged and withdraws undefined; actual interpretation, availability and process publication handling belong to the store owner. It guesses no platform path or directory capacity and does not validate a custom address here.
 */
export function shareTtscTransformCache(
  cache: TtscTransformCache,
  session: string | undefined,
): void {
  if (session === undefined) TRANSFORM_CACHE_SESSIONS.delete(cache);
  else TRANSFORM_CACHE_SESSIONS.set(cache, session);
}
