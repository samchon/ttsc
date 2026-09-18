import { SourceBuildCacheLayout } from "./SourceBuildCacheLayout";
import { resolveSourceBuildCachePaths } from "./resolveSourceBuildCachePaths";

/**
 * Resolve the directory where compiled plugin binaries are cached.
 *
 * Delegates to {@link resolveSourceBuildCachePaths}; kept as a thin accessor for
 * callers (and tests) that only need the plugin-binary root. Triggers the
 * opportunistic project-cache GC as a side effect for the default location.
 */
export function resolvePluginCacheRoot(
  projectRoot: string,
  cacheDir?: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const paths = resolveSourceBuildCachePaths(projectRoot, cacheDir, env);
  SourceBuildCacheLayout.maybePruneSourceBuildCaches(paths, cacheDir, env);
  return paths.pluginRoot;
}
