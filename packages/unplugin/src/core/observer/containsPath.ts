import path from "node:path";

/**
 * Whether `file` is `root` itself or lies below it, lexically.
 *
 * Decided through `path.relative` so that a sibling directory sharing a name
 * prefix is never inside the root, and a path on another drive never is.
 *
 * @evidence contracts/common.md#principled-implementation Native relative-path boundaries distinguish descendants from prefix-sharing siblings and unrelated roots; containment is deliberately lexical.
 * @evidence contracts/common.md#clear-and-simple-design One normalized relative path supplies all root, parent-escape, and cross-volume cases without a platform table.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts String-prefix matching and universal path lowercasing are absent; the result does not pretend lexical containment proves physical identity.
 * @evidence contracts/common.md#meaningful-documentation The comment states lexical scope and explains both sibling prefixes and other-drive rejection.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral containment uses native resolve, relative, separator, and absolute-root semantics, including Windows drive boundaries without a fixed drive or separator assumption.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The predicate acquires and retains no handle, task or state.
 * @evidence contracts/performance.md#efficient-algorithms Native resolve/relative process the two path strings and allocate normalized/relative text; cost follows their lengths and components, not the fixed comparison count. Relative parent/absolute checks avoid scanning filesystem entries or confusing shared textual prefixes with descent.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A pure predicate recomputed per call.
 */
export function containsPath(root: string, file: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(file));
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}
