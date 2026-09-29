/**
 * Test a set without allocating a transient array on the registration path.
 *
 * @evidence contracts/common.md#principled-implementation Direct iteration returns whether any member satisfies the predicate, including false for an empty set.
 * @evidence contracts/common.md#clear-and-simple-design Short-circuit iteration needs no intermediate collection and leaves predicate meaning to callers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Standard set iteration determines behavior without patched methods or test-data exceptions.
 * @evidence contracts/common.md#meaningful-documentation The comment explains why this helper avoids an array allocation on the registration path.
 */
export function someSet<T>(
  values: ReadonlySet<T>,
  predicate: (value: T) => boolean,
): boolean {
  for (const value of values) if (predicate(value)) return true;
  return false;
}
