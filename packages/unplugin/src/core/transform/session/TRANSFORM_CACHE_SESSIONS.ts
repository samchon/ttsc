import type { TtscTransformCache } from "../cache/TtscTransformCache";

/**
 * The shared compile store each pooled cache compiles through
 * (samchon/ttsc#1390).
 *
 * Only a cache whose owner declared a store through
 * {@link shareTtscTransformCache} shares its compiles. Every other cache,
 * including those of single-process hosts that happen to run inside a session,
 * compiles for itself exactly as before.
 */
export const TRANSFORM_CACHE_SESSIONS = new WeakMap<
  TtscTransformCache,
  string
>();
