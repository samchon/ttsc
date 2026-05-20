import fs from "node:fs";
import path from "node:path";

/**
 * Walk up the directory tree from `__dirname` until a directory that contains
 * both `package.json` and `go.mod` is found. This is the `packages/ttsc` root
 * and must be passed to `buildNativeCompiler` so it can locate `cmd/ttsc`.
 *
 * Uses `fs.realpathSync.native` when available to resolve symlinks identically
 * to the Go toolchain's own path resolution.
 *
 * Throws when the root cannot be found (i.e. the package is not in a Go
 * workspace), which would indicate a broken installation.
 */
export function packageRootDir(): string {
  let current = path.resolve(__dirname);
  while (true) {
    if (
      fs.existsSync(path.join(current, "package.json")) &&
      fs.existsSync(path.join(current, "go.mod"))
    ) {
      return fs.realpathSync.native?.(current) ?? fs.realpathSync(current);
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error("ttsc: package root not found for native compiler build");
    }
    current = parent;
  }
}

/**
 * Walk up the directory tree from `from` looking for a `go.mod` file. Stops
 * after `maxDepth` hops so callers can bound the search to a known
 * neighbourhood of the plugin source directory.
 *
 * Returns the absolute path to the first `go.mod` found, or `null` when no
 * `go.mod` exists within the depth limit or filesystem root is reached first.
 */
export function findNearestGoMod(
  from: string,
  maxDepth: number,
): string | null {
  let current = path.resolve(from);
  let depth = 0;
  while (true) {
    const candidate = path.join(current, "go.mod");
    if (fs.existsSync(candidate)) return candidate;
    if (depth >= maxDepth) return null;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
    depth += 1;
  }
}

/**
 * Return `true` when a relative path escapes its base directory — i.e. starts
 * with `..` or is an absolute path. Used by callers that need to guard against
 * path traversal before building output keys or spawning subprocesses.
 */
export function isOutsideRelativePath(relative: string): boolean {
  return (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  );
}
