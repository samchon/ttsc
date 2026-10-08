import fs from "node:fs";

/**
 * Junctions a workspace directory into a fixture's `node_modules`.
 *
 * Linking instead of copying exposes the target's current build. The caller
 * owns a fresh dependency tree or an already compatible destination. Any
 * reachable existing entry is left untouched without target validation;
 * dangling links or concurrent occupants can make link creation fail.
 *
 * @evidence contracts/common.md#principled-implementation An absent destination receives a native directory link to the supplied target; existing reachable entries are deliberately left untouched.
 * @evidence contracts/common.md#clear-and-simple-design One small helper owns linking within fresh caller-prepared dependency trees.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts This is a preparation primitive, not target-identity admission. Callers must own existing entries because existence alone does not prove a compatible dependency.
 * @evidence contracts/common.md#meaningful-documentation The comment explains linking instead of copying and preserving existing entries; existing-target compatibility remains a caller precondition.
 * @evidence contracts/portability.md#os-neutral-implementation Node symlink with junction creates the native directory-link form on Windows and a symlink on POSIX; callers supply actual native target paths.
 * @evidence contracts/performance.md#efficient-algorithms One existence check and at most one link creation avoid dependency-tree copying.
 * @evidence contracts/performance.md#reuse-equivalent-work Repeated calls avoid another creation for reachable existing entries, but do not revalidate their targets; dangling or competing occupants can fail link creation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The caller owns the dependency link and its parent tree; synchronous operations retain no native handle or process.
 */
export const linkDirectory = (target: string, location: string): void => {
  if (fs.existsSync(location)) return;
  fs.symlinkSync(target, location, "junction");
};
