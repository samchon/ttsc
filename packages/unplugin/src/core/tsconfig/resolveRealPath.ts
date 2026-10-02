import fs from "node:fs";

/**
 * Resolve symlinks, retaining the input spelling when realpath is unavailable.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Node realpath supplies physical spelling; a failed observation retains
 *   lexical spelling and does not claim that the target was resolved.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This helper owns best-effort physical resolution while callers own whether
 *   lexical fallback is enough for their cycle or root-spelling question.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Node's realpath observes native physical spelling; failure keeps the input
 *   distinct without an OS-wide name-case guess or guessed symlink target.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   It does not infer a physical target from an OS name or expected layout.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Documentation says any unavailable realpath retains spelling, including
 *   failures other than missing paths; it does not overclaim a successful probe.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function resolveRealPath(location: string): string {
  try {
    return fs.realpathSync(location);
  } catch {
    return location;
  }
}
