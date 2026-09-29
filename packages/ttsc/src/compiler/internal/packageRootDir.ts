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
 * Throws when the shipped package metadata and Go module cannot be found,
 * indicating an incomplete installation rather than a missing Go workspace.
 *
 * @evidence contracts/common.md#principled-implementation Upward ancestry stops at the package's paired npm and Go metadata, matching the root required to locate cmd/ttsc; realpath returns the physical build anchor.
 * @evidence contracts/common.md#clear-and-simple-design Root discovery owns one metadata predicate and one ancestry walk rather than relying on the compiler module's source-versus-lib depth.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The root is discovered from shipped metadata rather than a consumer fixture path or an assumed workspace layout.
 * @evidence contracts/common.md#meaningful-documentation The comment states the build consumer, physical-path choice and actual incomplete-installation failure, in paragraphs following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation path.resolve, join and dirname use native path syntax, and realpath obtains physical identity without deriving case policy from an OS name.
 * @evidence contracts/performance.md#efficient-algorithms For D ancestor directories the walk performs O(D) metadata checks and retains one current path; each parent is visited once and the filesystem root terminates the walk.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This discovery does not own a stable installed-metadata identity or invalidation source; retaining a result across filesystem changes would turn a fresh root query into stale authority.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Synchronous metadata checks retain no handles, history or tasks; the returned physical string transfers to the caller.
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
