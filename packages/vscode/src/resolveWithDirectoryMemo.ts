/**
 * Return the memoized result for a key, running resolve once per key.
 *
 * An undefined result is memoized too, so a directory with no usable project is
 * not resolved again within the same memo. The memo belongs to the caller and
 * should live for one reconciliation, so a later event rediscovers the project
 * from disk instead of trusting an old answer.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Map.has distinguishes a stored undefined from a missing key, so each key
 *   runs resolve at most once while its memo lives.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The function only pairs a caller-owned map with a caller-supplied
 *   resolver. Key construction and the lifetime of the memo stay with the
 *   caller.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No key or result is special-cased, and no global state is kept: equivalent
 *   work is shared through an explicit map.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states that undefined results are memoized and that the caller owns
 *   the memo and its lifetime, in separate paragraphs.
 */
export function resolveWithDirectoryMemo<T>(
  key: string,
  memo: Map<string, T | undefined>,
  resolve: () => T | undefined,
): T | undefined {
  if (memo.has(key)) {
    return memo.get(key);
  }
  const value = resolve();
  memo.set(key, value);
  return value;
}
