import fs from "node:fs";
import path from "node:path";

/** Filesystem facts required to discover an implicit TypeScript project. */
export interface TtscProjectDiscoveryFilesystem {
  /** Override path parsing when the observed filesystem is not the host. */
  platform?: NodeJS.Platform;
  /** Read metadata while following links, like an ordinary config-file open. */
  stat(location: string): Pick<fs.Stats, "isFile">;
}

const HOST_PROJECT_DISCOVERY_FILESYSTEM: TtscProjectDiscoveryFilesystem =
  Object.freeze({
    stat: fs.statSync,
  });

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
  const paths =
    filesystem.platform === undefined
      ? path
      : filesystem.platform === "win32"
        ? path.win32
        : path.posix;
  let current = paths.resolve(startDirectory);
  while (true) {
    const candidate = paths.join(current, "tsconfig.json");
    try {
      if (filesystem.stat(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // An implicit candidate is selectable only when its file kind is proven.
    }
    const parent = paths.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}
