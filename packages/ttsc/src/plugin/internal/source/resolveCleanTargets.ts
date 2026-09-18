import path from "node:path";
import { resolveSourceBuildCachePaths } from "./resolveSourceBuildCachePaths";
import { SourceBuildCacheLayout } from "./SourceBuildCacheLayout";

/**
 * Return every directory `ttsc clean` should remove for `projectRoot`.
 *
 * Covers the resolved plugin-binary root, a safely named nested `go-build/`, a
 * ttsc-owned Go build cache that lives OUTSIDE that root (`TTSC_GO_CACHE_DIR`),
 * and the two legacy project-local caches. A user-provided `GOCACHE` is never
 * removed. Pure over `env`, so the CLI passes `process.env` and a programmatic
 * caller can pass an injected environment.
 */
export function resolveCleanTargets(
  projectRoot: string,
  cacheDir?: string,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const paths = resolveSourceBuildCachePaths(projectRoot, cacheDir, env);
  // Remove ttsc-OWNED directories only, never the parent cache root.
  const targets = [paths.pluginRoot];
  // ttsc's nested `<root>/go-build` is only safe to delete when we are certain
  // the root belongs to ttsc: the default `node_modules/.cache/ttsc`, or a root
  // the user explicitly named `ttsc`. Under a shared root (e.g.
  // `TTSC_CACHE_DIR=~/.cache`) a bare `<root>/go-build` could be the user's
  // machine-wide GOCACHE, so it must never be removed by name.
  const isTtscOwnedRoot =
    (!cacheDir && !env.TTSC_CACHE_DIR) ||
    path.basename(paths.root) === SourceBuildCacheLayout.TTSC_CACHE_DIRNAME;
  if (isTtscOwnedRoot) {
    targets.push(path.join(paths.root, SourceBuildCacheLayout.GO_BUILD_CACHE_DIRNAME));
  }
  // An explicit TTSC_GO_CACHE_DIR is a ttsc-dedicated external cache; a
  // user-provided GOCACHE (source "GOCACHE") is never removed.
  if (paths.goBuildRootSource === "TTSC_GO_CACHE_DIR") {
    targets.push(paths.goBuildRoot);
  }
  targets.push(path.join(projectRoot, SourceBuildCacheLayout.NODE_MODULES_DIRNAME, ".ttsc"));
  targets.push(path.join(projectRoot, ".ttsc"));
  return targets;
}
