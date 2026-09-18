import { TRANSFORM_CACHE_EPOCHS } from "./TRANSFORM_CACHE_EPOCHS";
import type { TtscTransformCache } from "./TtscTransformCache";

/** The pass a delivery belongs to, or `undefined` under persistent validation. */
export function transformCacheEpoch(
  cache: TtscTransformCache | undefined,
): number | undefined {
  return cache === undefined ? undefined : TRANSFORM_CACHE_EPOCHS.get(cache);
}
