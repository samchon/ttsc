/** Test a set without allocating a transient array on the registration path. */
export function someSet<T>(
  values: ReadonlySet<T>,
  predicate: (value: T) => boolean,
): boolean {
  for (const value of values) if (predicate(value)) return true;
  return false;
}
