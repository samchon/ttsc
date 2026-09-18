import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { TRANSFORM_CACHE_FILESYSTEM } from "./TRANSFORM_CACHE_FILESYSTEM";
import type { TtscTransformCache } from "./TtscTransformCache";

/**
 * Return the filesystem view a delivery through `cache` must use.
 *
 * A cache created by `createTtscTransformCache` carries the operations it was
 * created with, which may observe a filesystem other than the host's. A
 * delivery without a cache, or through a cache created elsewhere, uses the host
 * filesystem.
 */
export function transformFilesystem(
  cache: TtscTransformCache | undefined,
): TtscTransformFilesystemOperations {
  return (
    (cache === undefined ? undefined : TRANSFORM_CACHE_FILESYSTEM.get(cache)) ??
    DEFAULT_FILESYSTEM_OPERATIONS
  );
}
