import fs from "node:fs";

/**
 * Resolve a path's physical target, or `undefined` when it cannot be resolved.
 *
 * Native resolution expands existing alternate names and linked targets. Its
 * returned spelling does not guarantee the spelling of a native event.
 *
 * @evidence contracts/common.md#principled-implementation Native realpath supplies an observed physical target, not a guarantee of event naming; unresolved topology remains undefined.
 * @evidence contracts/common.md#clear-and-simple-design One guarded resolver provides the target without another identity cache or platform rewrite.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed resolution cannot fabricate a target, and short-name expansion comes from the filesystem.
 * @evidence contracts/common.md#meaningful-documentation The prose defines failure and explains the watcher-facing purpose of native resolution.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral physical spelling comes from native realpath, including short names and junction targets, without universal lowercase or slash replacement.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The call returns before the function does; no handle is retained.
 * @evidence contracts/performance.md#efficient-algorithms One native realpath query performs path-component and link resolution; cost follows the supplied path and filesystem topology, not the wrapper's statement count.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call observes the current target by design, so nothing is shared.
 */
export function realpath(file: string): string | undefined {
  try {
    return fs.realpathSync.native(file);
  } catch {
    return undefined;
  }
}
