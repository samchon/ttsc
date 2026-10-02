import path from "node:path";

/**
 * Return `true` when a relative path escapes its base directory — i.e. starts
 * with `..` or is an absolute path. Used by callers that need to guard against
 * path traversal before building output keys or spawning subprocesses.
 *
 * The input must be a native relative-path result such as path.relative, not an
 * unnormalized user path or URL; embedded parent segments are not parsed.
 *
 * @evidence contracts/common.md#principled-implementation A normalized native relative result escapes through a leading parent component or an absolute different-root result; component boundaries prevent treating a name like ..notes as traversal.
 * @evidence contracts/common.md#clear-and-simple-design One predicate classifies path.relative results; normalization and filesystem identity remain the producing caller's responsibilities.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Classification follows native path semantics without special-casing project names or converting a URL into a filesystem identity.
 * @evidence contracts/common.md#meaningful-documentation The added input premise distinguishes this predicate from a general sanitizer, with separated paragraphs following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation path.sep and path.isAbsolute interpret native separators and different-drive results; protocol slash syntax and physical identity are deliberately outside this lexical predicate.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources isOutsideRelativePath acquires no handle, buffer or cache and retains nothing after it returns.
 * @evidenceExclude contracts/performance.md#efficient-algorithms isOutsideRelativePath performs a fixed number of steps with no loop or recursion over caller data.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work isOutsideRelativePath computes one result per call, so there is no repeated work to share.
 */
export function isOutsideRelativePath(relative: string): boolean {
  return (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  );
}
