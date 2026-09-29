import fs from "node:fs";

/**
 * Resolve a path's physical target, or `undefined` when it cannot be resolved.
 *
 * Uses the native resolver, so Windows short names expand to the spelling
 * native watchers report.
 *
 * @evidence contracts/common.md#principled-implementation Native realpath supplies the physical spelling reported by watchers; unresolved topology remains undefined.
 * @evidence contracts/common.md#clear-and-simple-design One guarded resolver provides the target without another identity cache or platform rewrite.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed resolution cannot fabricate a target, and short-name expansion comes from the filesystem.
 * @evidence contracts/common.md#meaningful-documentation The prose defines failure and explains the watcher-facing purpose of native resolution.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral physical spelling comes from native realpath, including short names and junction targets, without universal lowercase or slash replacement.
 */
export function realpath(file: string): string | undefined {
  try {
    return fs.realpathSync.native(file);
  } catch {
    return undefined;
  }
}
