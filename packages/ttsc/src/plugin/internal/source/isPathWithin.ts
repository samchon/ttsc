import path from "node:path";

/**
 * Report whether `child` equals `parent` or is lexically nested beneath it.
 *
 * This does not resolve symlinks or establish physical containment.
 *
 * @evidence contracts/common.md#principled-implementation Empty relative paths establish equality; rejecting parent traversal and absolute relative results excludes ancestors, siblings and other native volumes.
 * @evidence contracts/common.md#clear-and-simple-design One lexical predicate exposes containment without mixing physical realpath resolution into callers' already-resolved paths.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Parent traversal is checked by path components rather than an unsafe string-prefix exception for particular directories.
 * @evidence contracts/common.md#meaningful-documentation The native comment distinguishes lexical nesting from symlink-safe physical identity.
 * @evidence contracts/portability.md#os-neutral-implementation Node's native path.relative, separator and absolute-path rules cover volume and parent boundaries without inferring filesystem case policy from an OS name.
 * @evidence contracts/performance.md#efficient-algorithms Delegated native relative-path construction and prefix checks process supplied path text without enumerating directories. Node's Windows Unicode-folding fallback can allocate component arrays; relative inputs may also consult current-directory state during resolution. Temporary strings/arrays follow those delegated path lengths rather than a fixed allocation count.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The predicate compares supplied paths and stores no cross-request result.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This query retains no handle or state and performs no direct filesystem-entry inspection; any current-directory resolution belongs to the native path operation.
 */
export function isPathWithin(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return (
    rel === "" ||
    (rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel))
  );
}
