import { SourceBuildCacheLayout } from "./SourceBuildCacheLayout";
import { resolveSourceBuildCachePaths } from "./resolveSourceBuildCachePaths";

/**
 * Resolve the directory where compiled plugin binaries are cached.
 *
 * Delegates to {@link resolveSourceBuildCachePaths}; kept as a thin accessor for
 * callers that only need the plugin-binary root. Triggers the opportunistic
 * project-cache GC attempts as a side effect for the default location.
 * Admission, protected entries and tolerated failures can defer reclamation;
 * this accessor does not certify a storage ceiling or successful eviction.
 *
 * @evidence contracts/common.md#principled-implementation The binary root comes from the shared source layout and only ownership-admitted default caches are opportunistically pruned.
 * @evidence contracts/common.md#clear-and-simple-design One adapter delegates selection and maintenance before projecting pluginRoot.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Effective environment injection preserves host ownership without mutating process globals or substituting recognized projects.
 * @evidence contracts/common.md#meaningful-documentation The native description states that this convenience query can perform maintenance; tags remain separate from prose.
 * @evidence contracts/portability.md#os-neutral-implementation Platform path and deletion boundaries remain with native-aware shared helpers.
 * @evidence contracts/performance.md#efficient-algorithms Cost includes root discovery and admitted full maintenance passes, not merely constant projection.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This location/maintenance adapter does not validate binary content keys or coordinate completed or in-flight producers.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources Default cache populations receive their collectors' opportunistic reclamation attempts, including protected/live entries and deletion failures that can leave growth unbounded. Collector coordination/history remain with those owners; explicit roots keep caller-controlled lifetime.
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
