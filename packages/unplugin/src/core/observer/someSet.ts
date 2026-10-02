/**
 * Test a set without allocating a transient array on the registration path.
 *
 * @evidence contracts/common.md#principled-implementation Direct iteration returns whether any member satisfies the predicate, including false for an empty set.
 * @evidence contracts/common.md#clear-and-simple-design Short-circuit iteration needs no intermediate collection and leaves predicate meaning to callers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Standard set iteration determines behavior without patched methods or test-data exceptions.
 * @evidence contracts/common.md#meaningful-documentation The comment explains why this helper avoids an array allocation on the registration path.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The scan acquires and retains no handle, task or state.
 * @evidence contracts/performance.md#efficient-algorithms Iterates the set once with an early exit and allocates no array, so it is linear in the set at worst.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A pure predicate over its arguments.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Tests set members with a caller predicate; no path or filesystem is read.
 */
export function someSet<T>(
  values: ReadonlySet<T>,
  predicate: (value: T) => boolean,
): boolean {
  for (const value of values) if (predicate(value)) return true;
  return false;
}
