import path from "node:path";

/**
 * Whether `child` is `parent` itself or lies below it, lexically.
 *
 * Decided through `path.relative`, never by string prefix, so a sibling such as
 * `/repo2` is not inside `/repo` and a path on another drive or share is never
 * inside anything local.
 * The optional platform selects an observed filesystem's path grammar; the
 * host platform supplies the default for ordinary native callers.
 *
 * @evidence contracts/common.md#principled-implementation A lexical relative path distinguishes root equality and descendants from parent escapes and unrelated volumes, without confusing siblings sharing a prefix.
 * @evidence contracts/common.md#clear-and-simple-design One native relative-path calculation supplies the boundary decisions; physical alias resolution belongs to callers that require it.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts String-prefix containment and unconditional case folding are absent, and lexical containment does not claim physical ownership.
 * @evidence contracts/common.md#meaningful-documentation The native comment states lexical scope and explains sibling and cross-root rejection.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral root boundaries use native relative, separator, and absolute-path semantics, including drive/share differences without hardcoded platform roots.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function pathIsWithin(
  child: string,
  parent: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const relative = pathApi.relative(parent, child);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${pathApi.sep}`) &&
      !pathApi.isAbsolute(relative))
  );
}
