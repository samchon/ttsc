import { normalizePath } from "../transform/filesystem/normalizePath";

/**
 * Compile the `filter` loader option into one predicate over delivered module
 * paths, or `undefined` when no module is skipped.
 *
 * The predicate tests a copy of each pattern, so a global or sticky pattern
 * carries no match position from one module to the next and the caller's
 * pattern is never changed. It tests the path with `\` written as `/` and
 * leaves the delivered path itself untouched for reading and compiling.
 *
 * @throws TypeError when an entry of `filter` is not a RegExp.
 * @evidence contracts/common.md#principled-implementation
 *   `RegExp.prototype.test` on a global or sticky pattern reads and writes
 *   `lastIndex`, so a copy reset to zero before each test makes every answer
 *   depend on the path alone; `new RegExp(pattern)` keeps source and flags.
 *   An empty list names no restriction.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Validation, ownership of the copies and matching concern the same patterns,
 *   so one function answers the loader's one question. The loader keeps
 *   the decision of what a skipped module returns.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The `lastIndex` reset follows from the language's stateful `test`,
 *   not from a consumer; no RegExp prototype or caller pattern is modified.
 * @evidence contracts/common.md#meaningful-documentation
 *   The comment states pattern ownership, the tested spelling, the `undefined`
 *   result and the thrown failure, which the signature does not show.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Only the string under test is converted, with the repository's separator
 *   conversion. The native path is never rewritten and no filesystem identity
 *   or case policy is implied. A POSIX file name containing a backslash
 *   is tested as if the backslash were a separator.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Construction copies the P supplied patterns once; a call converts a path
 *   of length L once and tests patterns in order until the first match,
 *   so its cost is O(L) plus the cost of the patterns the caller wrote.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own; the loader builds the predicate once per session
 *   and calls it per module.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The predicate retains only its P pattern copies for as long as the loader
 *   holds it, bounded by the supplied list, and acquires no handle or task.
 */
export function createBunFilter(
  filter: RegExp | readonly RegExp[] | undefined,
): ((path: string) => boolean) | undefined {
  if (filter === undefined) return undefined;
  const supplied: unknown[] = [filter].flat();
  if (supplied.length === 0) return undefined;
  const patterns = supplied.map((pattern) => {
    if (!(pattern instanceof RegExp))
      throw new TypeError(
        "@ttsc/unplugin filter must be a RegExp or an array of RegExp.",
      );
    return new RegExp(pattern);
  });
  return (path) => {
    const spelling = normalizePath(path);
    return patterns.some((pattern) => {
      pattern.lastIndex = 0;
      return pattern.test(spelling);
    });
  };
}
