import type { TtscTransformCache } from "./TtscTransformCache";
import type { TtscTransformCacheLease } from "./TtscTransformCacheLease";

/**
 * One process-wide build-scoped cache and its lease (samchon/ttsc#1396).
 *
 * @evidence contracts/common.md#principled-implementation Cache and lease are paired so every shared compiler session participates in the lifetime of the same retained generations.
 * @evidence contracts/common.md#clear-and-simple-design The shape names the two existing owners without duplicating their entries or lifecycle state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The pair expresses retention ownership, not unconditional freshness or a host-specific bypass.
 * @evidence contracts/common.md#meaningful-documentation Native member comments distinguish compiled-entry storage from cross-session lifetime ownership.
 */
export interface TtscSharedBuildTransformCache {
  /** The shared cache. */
  cache: TtscTransformCache;

  /** Its lifetime across the sessions that use it. */
  lease: TtscTransformCacheLease;
}
