import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import type { TtscTransformCache } from "./TtscTransformCache";

/**
 * The filesystem view each transform cache was created with.
 *
 * Kept beside the cache instead of on it, so `TtscTransformCache` stays a plain
 * `Map` for its callers while every generation the cache produces is captured
 * and validated through one consistent view. Weakly held, so a released cache
 * releases its view.
 */
export const TRANSFORM_CACHE_FILESYSTEM = new WeakMap<
  TtscTransformCache,
  TtscTransformFilesystemOperations
>();
