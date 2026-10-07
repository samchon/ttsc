import fs from "node:fs";
import path from "node:path";

/**
 * Walk up the directory tree from `__dirname` until a directory that contains
 * both `package.json` and `go.mod` exists. Within the shipped package this
 * selects the build root passed to `buildNativeCompiler` for `cmd/ttsc`;
 * existence checks do not parse those entries or validate the command tree.
 *
 * Uses `fs.realpathSync.native` when available to produce the physical anchor
 * passed to the Go build. It does not model every Go toolchain path
 * convention.
 *
 * Throws when the shipped package metadata and Go module cannot be found,
 * indicating an incomplete installation rather than a missing Go workspace.
 * Native realpath errors propagate if the selected anchor cannot be resolved.
 *
 * @evidence contracts/common.md#principled-implementation Upward ancestry stops at the package's paired npm and Go metadata, matching the root required to locate cmd/ttsc; realpath returns the physical build anchor.
 * @evidence contracts/common.md#clear-and-simple-design Root discovery owns one metadata predicate and one ancestry walk rather than relying on the compiler module's source-versus-lib depth.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The root is discovered from shipped metadata rather than a consumer fixture path or an assumed workspace layout.
 * @evidence contracts/common.md#meaningful-documentation The comment states the build consumer, physical-path choice and actual incomplete-installation failure, in paragraphs following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation path.resolve, join and dirname use native path syntax, and realpath obtains physical identity without deriving case policy from an OS name.
 * @evidence contracts/performance.md#efficient-algorithms D visited ancestors incur at most two existence checks each plus native path joins/dirname work proportional to traversed text lengths. The selected root incurs one realpath operation with delegated filesystem costs; parent equality terminates the walk without directory enumeration. Invocation-local path storage depends on path length rather than a fixed string count bounding bytes.
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
