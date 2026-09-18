import { HOST_PROJECT_DISCOVERY_FILESYSTEM } from "./HOST_PROJECT_DISCOVERY_FILESYSTEM";
import type { TtscProjectDiscoveryFilesystem } from "./TtscProjectDiscoveryFilesystem";
import { findNearestProjectTsconfigImpl } from "./findNearestProjectTsconfigImpl";

/**
 * Find the nearest ancestor `tsconfig.json` that is proven to be a file.
 *
 * A directory, broken link, permission failure, or any other unprovable
 * candidate cannot terminate the walk. `stat` deliberately follows links, so a
 * link to a regular file retains its lexical config spelling.
 */
export function findNearestProjectTsconfig(
  startDirectory: string,
  filesystem: TtscProjectDiscoveryFilesystem = HOST_PROJECT_DISCOVERY_FILESYSTEM,
): string | undefined {
  return findNearestProjectTsconfigImpl(startDirectory, filesystem);
}
