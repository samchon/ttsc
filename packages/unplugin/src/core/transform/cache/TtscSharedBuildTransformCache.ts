import type { TtscTransformCache } from "./TtscTransformCache";
import type { TtscTransformCacheLease } from "./TtscTransformCacheLease";

/** One process-wide build-scoped cache and its lease (samchon/ttsc#1396). */
export interface TtscSharedBuildTransformCache {
  /** The shared cache. */
  cache: TtscTransformCache;
  /** Its lifetime across the sessions that use it. */
  lease: TtscTransformCacheLease;
}
