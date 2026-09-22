import fs from "node:fs";
import path from "node:path";

import type { ITtscSourceBuildCachePaths } from "./ITtscSourceBuildCachePaths";
import { SourceBuildCacheLayout } from "./SourceBuildCacheLayout";

/**
 * Resolve all source-plugin build cache directories for one invocation.
 *
 * `pluginRoot` stores compiled plugin binaries; `goBuildRoot` is the Go object
 * cache passed as `GOCACHE` while ttsc builds those binaries. The default Go
 * cache lives under `root`; an explicit `TTSC_GO_CACHE_DIR` or `GOCACHE` keeps
 * its independently resolved location and ownership policy.
 */
export function resolveSourceBuildCachePaths(
  projectRoot: string,
  cacheDir?: string,
  env: NodeJS.ProcessEnv = process.env,
): ITtscSourceBuildCachePaths {
  const root = resolveSourceBuildCacheRoot(projectRoot, cacheDir, env);
  const goBuild = resolveGoBuildCacheRoot(root, projectRoot, env);
  return {
    root,
    pluginRoot: path.join(root, PLUGIN_CACHE_DIRNAME),
    goBuildRoot: goBuild.root,
    goBuildRootSource: goBuild.source,
  };
}

const LOCAL_CACHE_PARENT_DIRNAME = ".cache";

const PLUGIN_CACHE_DIRNAME = "plugins";

// Directories whose presence marks a monorepo/workspace root, so every package
// in the workspace shares ONE cache and a plugin builds once, not once per
// package. `package.json` with a `workspaces` field (yarn/npm/bun) is checked
// separately in isWorkspaceRootDir.
const WORKSPACE_ROOT_MARKER_FILES: readonly string[] = ["pnpm-workspace.yaml"];

/**
 * Resolve the cache root for one invocation.
 *
 * Priority:
 *
 * 1. Explicit `cacheDir` option (resolved relative to `projectRoot`);
 * 2. `TTSC_CACHE_DIR` environment variable (resolved absolute);
 * 3. `<workspaceRoot>/node_modules/.cache/ttsc` — project-local by default.
 *
 * There is deliberately NO global (`~/.cache`) fallback: the cache is scoped to
 * the workspace so it can never accumulate machine-wide, and `rm -rf
 * node_modules` reclaims it.
 */
function resolveSourceBuildCacheRoot(
  projectRoot: string,
  cacheDir: string | undefined,
  env: NodeJS.ProcessEnv,
): string {
  if (cacheDir) {
    return path.resolve(projectRoot, cacheDir);
  }
  if (env.TTSC_CACHE_DIR) {
    // Anchor a relative TTSC_CACHE_DIR to the project root (not the process
    // cwd) so a programmatic host whose cwd differs from the project still
    // resolves — and later cleans — the same cache. Absolute values pass
    // through path.resolve unchanged.
    return path.resolve(projectRoot, env.TTSC_CACHE_DIR);
  }
  return path.join(
    resolveWorkspaceRoot(projectRoot),
    SourceBuildCacheLayout.NODE_MODULES_DIRNAME,
    LOCAL_CACHE_PARENT_DIRNAME,
    SourceBuildCacheLayout.TTSC_CACHE_DIRNAME,
  );
}

/**
 * Resolve the monorepo/workspace root for `projectRoot` so every package shares
 * one cache and a plugin builds once per workspace, not once per package.
 *
 * Walks up from `projectRoot` and returns, in order of preference: the NEAREST
 * ancestor that is a workspace root (holds `pnpm-workspace.yaml`, or a
 * `package.json` with a `workspaces` field); else the nearest ancestor that
 * contains an installation; else the outermost ttsc-only cache owner below the
 * nearest ordinary package manifest, or `projectRoot` itself.
 *
 * A directory whose only payload is ttsc's own `.cache/ttsc` tree is not
 * installation evidence: an older ttsx may have created that tree below a
 * nested tsconfig before this resolver ran. Remembering the outermost such
 * owner still gives manifest-less projects a stable answer after their empty
 * `node_modules` becomes a ttsc cache on the first run.
 *
 * Nearest (not highest) so an unrelated ancestor that happens to declare
 * `workspaces` — for example a `package.json` in the user's home directory —
 * cannot pull the cache above the project's real monorepo root.
 */
function resolveWorkspaceRoot(projectRoot: string): string {
  let dir = path.resolve(projectRoot);
  let nearestNodeModulesOwner: string | null = null;
  let outermostTtscCacheOwner: string | null = null;
  let packageBoundarySeen = false;
  for (;;) {
    if (isWorkspaceRootDir(dir)) {
      return dir;
    }
    const nodeModules = classifyNodeModulesBoundary(dir);
    if (nearestNodeModulesOwner === null && nodeModules === "installation") {
      nearestNodeModulesOwner = dir;
    } else if (nodeModules === "ttsc-cache" && !packageBoundarySeen) {
      outermostTtscCacheOwner = dir;
    }
    packageBoundarySeen ||= hasPackageManifest(dir);
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return (
    nearestNodeModulesOwner ??
    outermostTtscCacheOwner ??
    path.resolve(projectRoot)
  );
}

/**
 * Classify the evidence carried by `dir/node_modules`.
 *
 * An empty directory remains installation evidence for package managers and
 * callers that materialize the root before populating it. The distinguished
 * `ttsc-cache` shape is an ordinary `.cache/ttsc` tree with no sibling: every
 * byte below it is owned by this product, so counting it as an installation
 * would let ttsc's output change its own workspace-root query. Links and
 * unreadable directories remain installations because they cannot be proved
 * ttsc-owned.
 */
function classifyNodeModulesBoundary(
  dir: string,
): "absent" | "installation" | "ttsc-cache" {
  const nodeModules = path.join(
    dir,
    SourceBuildCacheLayout.NODE_MODULES_DIRNAME,
  );
  if (!fs.existsSync(nodeModules)) return "absent";
  try {
    if (fs.lstatSync(nodeModules).isSymbolicLink()) return "installation";
    const entries = fs.readdirSync(nodeModules, { withFileTypes: true });
    const cache = entries.length === 1 ? entries[0] : undefined;
    if (!isOrdinaryDirectory(cache, LOCAL_CACHE_PARENT_DIRNAME)) {
      return "installation";
    }

    const cacheEntries = fs.readdirSync(
      path.join(nodeModules, LOCAL_CACHE_PARENT_DIRNAME),
      { withFileTypes: true },
    );
    const ttsc = cacheEntries.length === 1 ? cacheEntries[0] : undefined;
    return isOrdinaryDirectory(ttsc, SourceBuildCacheLayout.TTSC_CACHE_DIRNAME)
      ? "ttsc-cache"
      : "installation";
  } catch {
    return "installation";
  }
}

function hasPackageManifest(dir: string): boolean {
  try {
    return fs.statSync(path.join(dir, "package.json")).isFile();
  } catch {
    return false;
  }
}

function isOrdinaryDirectory(
  entry: fs.Dirent | undefined,
  name: string,
): boolean {
  return entry?.name === name && entry.isDirectory() && !entry.isSymbolicLink();
}

function isWorkspaceRootDir(dir: string): boolean {
  for (const marker of WORKSPACE_ROOT_MARKER_FILES) {
    if (fs.existsSync(path.join(dir, marker))) {
      return true;
    }
  }
  return packageJsonDeclaresWorkspaces(path.join(dir, "package.json"));
}

function packageJsonDeclaresWorkspaces(packageJsonPath: string): boolean {
  let text: string;
  try {
    text = fs.readFileSync(packageJsonPath, "utf8");
  } catch {
    return false;
  }
  try {
    const workspaces = (JSON.parse(text) as { workspaces?: unknown })
      .workspaces;
    // A real workspace root declares a NON-EMPTY package list (an array, or an
    // object with a `packages` array). Ignore `false`, `[]`, `null`, or `{}` so
    // a disabled or empty declaration on an unrelated ancestor cannot hijack
    // the cache location.
    if (Array.isArray(workspaces)) {
      return workspaces.length > 0;
    }
    if (workspaces !== null && typeof workspaces === "object") {
      const packages = (workspaces as { packages?: unknown }).packages;
      return Array.isArray(packages) && packages.length > 0;
    }
    return false;
  } catch {
    return false;
  }
}

function resolveGoBuildCacheRoot(
  root: string,
  projectRoot: string,
  env: NodeJS.ProcessEnv,
): {
  root: string;
  source: ITtscSourceBuildCachePaths["goBuildRootSource"];
} {
  if (env.TTSC_GO_CACHE_DIR) {
    // Anchor a relative TTSC_GO_CACHE_DIR to the project root, matching
    // TTSC_CACHE_DIR, so the build and a later `clean` from a different cwd
    // agree on the directory. Absolute values pass through unchanged.
    return {
      root: path.resolve(projectRoot, env.TTSC_GO_CACHE_DIR),
      source: "TTSC_GO_CACHE_DIR",
    };
  }
  if (env.GOCACHE && env.GOCACHE.length > 0) {
    return {
      root: env.GOCACHE,
      source: "GOCACHE",
    };
  }
  return {
    root: path.join(root, SourceBuildCacheLayout.GO_BUILD_CACHE_DIRNAME),
    source: "ttsc-cache",
  };
}
