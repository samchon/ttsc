import path from "node:path";

/**
 * Resolve a user-supplied `--cache-dir` value into an absolute path.
 *
 * When `cacheDir` is absent or empty, returns `undefined` so callers fall
 * through to the environment variable and global-cache defaults handled inside
 * `buildSourcePlugin`. When `cacheDir` is already absolute it is returned
 * unchanged; otherwise it is resolved relative to `cwd`.
 */
export function resolveCacheDir(
  cwd: string,
  cacheDir?: string,
): string | undefined {
  if (!cacheDir) {
    return undefined;
  }
  return path.isAbsolute(cacheDir) ? cacheDir : path.resolve(cwd, cacheDir);
}
