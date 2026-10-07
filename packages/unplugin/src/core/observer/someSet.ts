/**
 * Test a set without allocating a transient array on the registration path.
 *
 * @evidence contracts/common.md#principled-implementation Direct iteration returns whether any member satisfies the predicate, including false for an empty set.
 * @evidence contracts/common.md#clear-and-simple-design Short-circuit iteration needs no intermediate collection and leaves predicate meaning to callers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Standard set iteration determines behavior without patched methods or test-data exceptions.
 * @evidence contracts/common.md#meaningful-documentation The comment explains why this helper avoids an array allocation on the registration path.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The scan acquires and retains no handle, task or state.
 * @evidence contracts/performance.md#efficient-algorithms Direct iteration short-circuits after the first match and allocates no array. Reached members drive iteration cost; supplied predicate work is additional and need not be constant.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This invocation coordinates no cross-query computation sharing. The caller owns predicate effects and any shared lookup state; a callback is not assumed pure merely because it returns boolean.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Tests set members with a caller predicate; no path or filesystem is read.
 */
export function someSet<T>(
  values: ReadonlySet<T>,
  predicate: (value: T) => boolean,
): boolean {
  for (const value of values) if (predicate(value)) return true;
  return false;
}
