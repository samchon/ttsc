import path from "node:path";

import type { TtscProjectDiscoveryFilesystem } from "./TtscProjectDiscoveryFilesystem";
import type { TtscProjectTsconfigCandidate } from "./TtscProjectTsconfigCandidate";

/** Shared walk with optional observation retention for cache hosts. */
export function findNearestProjectTsconfigImpl(
  startDirectory: string,
  filesystem: TtscProjectDiscoveryFilesystem,
  candidates?: TtscProjectTsconfigCandidate[],
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
    let fileExists = false;
    try {
      fileExists = filesystem.stat(candidate).isFile();
    } catch {
      // An implicit candidate is selectable only when its file kind is proven.
    }
    candidates?.push({ file: candidate, fileExists });
    if (fileExists) {
      return candidate;
    }
    const parent = paths.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}
