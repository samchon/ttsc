/**
 * JSON-serialise `value` with object keys sorted alphabetically.
 *
 * JSON preserves insertion order for ordinary object keys. Sorting those keys
 * makes equivalent JSON option values independent of construction order while
 * retaining JSON's omission and array-null rules. Non-serializable roots and
 * cyclic values fail instead of acquiring a misleading cache identity.
 *
 * @evidence contracts/common.md#principled-implementation
 *   JSON.stringify supplies the same value conversion used by configuration
 *   serialization; a replacer sorts object keys without changing array order.
 *   Memoized sorted objects preserve shared identity so JSON still detects cycles.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One serialization boundary owns ordering and delegates value semantics to
 *   JSON rather than maintaining a separate recursive encoding for cache keys.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The method removes the false assumption that joining array encodings
 *   preserves omitted elements; no fixture-specific marker or fallback is added.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain insertion-order independence, omission and failure
 *   behavior. Prose and tags follow the documentation skill's spacing guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   Sorts the keys of each object once; the WeakMap avoids sorting a shared
 *   object twice.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The WeakMap reuses the sorted copy of an object that occurs more than
 *   once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The WeakMap is local and weak, released when the call returns.
 */
export function stableStringify(value: unknown): string {
  const sorted = new WeakMap<object, Record<string, unknown>>();
  const result = JSON.stringify(value, (_key, item: unknown) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      return item;
    }
    const existing = sorted.get(item);
    if (existing !== undefined) return existing;
    const ordered = Object.fromEntries(
      Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0,
      ),
    );
    sorted.set(item, ordered);
    return ordered;
  });
  if (result === undefined) {
    throw new TypeError("The value has no JSON serialization.");
  }
  return result;
}
