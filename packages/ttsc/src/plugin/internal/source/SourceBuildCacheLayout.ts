import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { ITtscSourceBuildCachePaths } from "./ITtscSourceBuildCachePaths";
import { pruneGoBuildCacheRoot } from "./pruneGoBuildCacheRoot";
import { prunePluginCacheRoot } from "./prunePluginCacheRoot";

/**
 * The layout of ttsc's source-plugin cache and the file operations its
 * maintenance shares.
 *
 * The default cache lives inside the workspace, at
 * `<workspaceRoot>/node_modules/.cache/ttsc`, so removing `node_modules` (or
 * the repository) reclaims every compiled plugin binary and Go object file.
 * This is the `find-cache-dir` convention (Babel, webpack, ESLint, Nuxt): a
 * disposable build cache under `node_modules/.cache/<tool>`. ttsc keeps no
 * global (`~/.cache`) cache; a machine-wide one silently grew to hundreds of GB
 * across tsgo and plugin version bumps, so it was removed outright. See
 * `resolveSourceBuildCachePaths` for the override-then-workspace priority.
 */
export namespace SourceBuildCacheLayout {
  /** Directory name the workspace-local cache is placed under. */
  export const NODE_MODULES_DIRNAME = "node_modules";

  /** Directory name of ttsc's cache root below `node_modules/.cache`. */
  export const TTSC_CACHE_DIRNAME = "ttsc";

  /** Directory name of ttsc's own Go object cache inside the cache root. */
  export const GO_BUILD_CACHE_DIRNAME = "go-build";

  /** File inside a plugin cache entry recording when it was last used. */
  export const CACHE_LAST_USED_FILE = ".last-used";

  /**
   * Run the opportunistic pruning of the plugin cache and of ttsc's Go object
   * cache, but only for the default workspace-local location. A root the caller
   * named through `cacheDir` or `TTSC_CACHE_DIR` is theirs, and ttsc never
   * deletes from it.
   */
  export function maybePruneSourceBuildCaches(
    paths: ITtscSourceBuildCachePaths,
    cacheDir: string | undefined,
    env: NodeJS.ProcessEnv = process.env,
  ): void {
    // GC only the default (workspace-local) location. When the user pins an
    // explicit `cacheDir`/`TTSC_CACHE_DIR`, they own its lifetime, so ttsc must
    // not delete entries out from under them. `env` is the effective instance
    // environment so a programmatic caller that pins `TTSC_CACHE_DIR` only in
    // `context.env` is honored without leaning on the shared `process.env`.
    if (!cacheDir && !env.TTSC_CACHE_DIR) {
      prunePluginCacheRoot(paths.pluginRoot);
      if (paths.goBuildRootSource === "ttsc-cache") {
        pruneGoBuildCacheRoot(paths.goBuildRoot);
      }
    }
  }

  /** Pin the default plugin cache to one ordinary physical directory. */
  export function canonicalPluginCacheRoot(root: string): string {
    fs.mkdirSync(root, { recursive: true });
    const physicalParent = fs.realpathSync.native(path.dirname(root));
    const stats = fs.lstatSync(root);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error(`ttsc: unsafe plugin cache root: ${root}`);
    }
    // If an ancestor alias is retargeted after this point, all later cache work
    // stays on the original physical directory rather than following it.
    const physicalRoot = fs.realpathSync.native(root);
    if (path.dirname(physicalRoot) !== physicalParent) {
      throw new Error(`ttsc: plugin cache root escaped its parent: ${root}`);
    }
    return physicalRoot;
  }

  /**
   * The millisecond timestamp a metadata file records, falling back to its
   * mtime when its content is not a number; `null` when it cannot be read.
   */
  export function readTimestamp(file: string): number | null {
    try {
      const text = fs.readFileSync(file, "utf8").trim();
      const value = Number(text);
      if (Number.isFinite(value)) {
        return value;
      }
    } catch {}
    try {
      return fs.statSync(file).mtimeMs;
    } catch {
      return null;
    }
  }

  /** Replace cache metadata without following a pre-existing link or hard link. */
  export function replaceCacheMetadataFile(
    file: string,
    contents: string,
  ): void {
    const temporary = path.join(
      path.dirname(file),
      `.${path.basename(file)}.${process.pid}-${crypto
        .randomBytes(16)
        .toString("hex")}.tmp`,
    );
    try {
      fs.writeFileSync(temporary, contents, { encoding: "utf8", flag: "wx" });
      // rename replaces the directory entry itself. Unlike writeFile(file), it
      // cannot follow a symlink or mutate another hard link to the old inode.
      fs.renameSync(temporary, file);
    } finally {
      try {
        fs.rmSync(temporary, { force: true });
      } catch {}
    }
  }
}
