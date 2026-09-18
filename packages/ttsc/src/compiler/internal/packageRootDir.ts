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
