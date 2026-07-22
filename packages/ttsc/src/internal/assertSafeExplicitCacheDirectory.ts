import path from "node:path";

/**
 * Refuse an explicit cache directory whose wholesale removal could delete the
 * project or an entire filesystem volume.
 */
export function assertSafeExplicitCacheDirectory(
  projectRoot: string,
  cacheDirectory: string,
): void {
  const project = path.resolve(projectRoot);
  const cache = path.resolve(cacheDirectory);
  if (cache === path.parse(cache).root) {
    throw new Error(
      `ttsc: refusing to clean cache directory ${JSON.stringify(cache)} because filesystem roots are never valid cache directories`,
    );
  }
  const relative = path.relative(cache, project);
  if (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  ) {
    throw new Error(
      `ttsc: refusing to clean cache directory ${JSON.stringify(cache)} because it equals or contains project root ${JSON.stringify(project)}; choose a dedicated cache directory`,
    );
  }
}
