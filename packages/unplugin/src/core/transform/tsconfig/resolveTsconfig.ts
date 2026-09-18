import path from "node:path";

import { findNearestProjectTsconfig } from "../../discovery/findNearestProjectTsconfig";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";

/**
 * Locate the tsconfig that should govern the transform for `file`.
 *
 * If `tsconfig` is supplied it is returned as-is (absolute) or resolved from
 * `process.cwd()` (relative). Otherwise the function walks ancestor directories
 * starting at `file`'s directory, returning the first `tsconfig.json` proven to
 * be a file. Falls back to `<cwd>/tsconfig.json` when no ancestor contains one;
 * the compiler will error if that file does not exist, which is the correct
 * behavior for a mis-configured project.
 */
export function resolveTsconfig(
  file: string,
  tsconfig?: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): string {
  if (tsconfig !== undefined) {
    return path.isAbsolute(tsconfig)
      ? tsconfig
      : path.resolve(process.cwd(), tsconfig);
  }

  const discovered = findNearestProjectTsconfig(path.dirname(file), filesystem);
  if (discovered !== undefined) {
    return discovered;
  }
  return path.resolve(process.cwd(), "tsconfig.json");
}
