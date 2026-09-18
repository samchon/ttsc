import { TRANSFORM_CACHE_EPOCHS } from "./TRANSFORM_CACHE_EPOCHS";
import type { TtscTransformCache } from "./TtscTransformCache";

/**
 * Open a new delivery pass, enabling constant-time first delivery for every
 * module this pass asks for.
 *
 * This deliberately retains the cached generation. The pass boundary is a
 * statement about _deliveries_ — each module is requested at most once inside
 * it — not about whether the compiled program is still correct, which the
 * generation's own recorded snapshot answers and which `matchesCachedSource`
 * proves once at the pass's first delivery. Clearing here instead made a host
 * whose `buildStart` repeats recompile the whole project on every rebuild even
 * when no compiler input had changed (samchon/ttsc#1300). Use
 * `resetTtscTransformCache` to actually discard a generation and its watchers.
 *
 * Hosts without a guaranteed pass boundary use persistent validation unless
 * they have another immutable lifecycle. Bun runtime setup, for example,
 * defines one process-scoped module-loading session.
 */
export function beginTtscTransformBuild(cache: TtscTransformCache): void {
  TRANSFORM_CACHE_EPOCHS.set(
    cache,
    (TRANSFORM_CACHE_EPOCHS.get(cache) ?? 0) + 1,
  );
}
