/**
 * Canonical JSON serialization for plain JSON records and arrays.
 *
 * Non-index object keys are sorted lexically; array elements and integer-index
 * keys retain JSON's own order. This makes equivalent host-owned JSON records
 * independent of construction order while preserving omission and array-null
 * rules. Non-serializable roots and cyclic values fail instead of acquiring a
 * misleading cache identity. Compiler and plugin payloads whose declaration
 * order is observable are serialized by their owner before this function.
 *
 * @evidence contracts/common.md#principled-implementation
 *   JSON.stringify supplies the same value conversion used by configuration
 *   serialization; a replacer sorts object keys without changing array order.
 *   Memoized sorted objects preserve shared identity so JSON still detects cycles.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One serialization boundary owns ordering and delegates value semantics to
 *   JSON rather than maintaining a separate recursive encoding for cache keys.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Native JSON conversion preserves omitted-member and array-null semantics;
 *   no fixture-specific marker or fallback encoding is added.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain insertion-order independence, omission and failure
 *   behavior. Prose and tags follow the documentation skill's spacing guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Each distinct record's K keys are sorted once in O(K log K) comparisons;
 *   temporary copies scale with distinct record entries. Native serialization
 *   also scales with emitted JSON bytes, including repeated shared subtrees.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   One call reuses a record's ordered copy by original object identity.
 *   Plain JSON input remains unchanged during synchronous serialization;
 *   no copy crosses calls, and shared copies preserve native cycle detection.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The invocation owns the WeakMap and ordered copies, proportional to
 *   distinct records visited. They become unreachable on return or throw;
 *   no historical cache, task or native handle survives the invocation.
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
