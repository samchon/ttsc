/**
 * Recursively readonly view of compiler graph records and arrays.
 *
 * @evidence contracts/common.md#principled-implementation Recursive mapped properties and array elements prevent typed consumers from mutating nested snapshot facts.
 * @evidence contracts/common.md#clear-and-simple-design One view type preserves the wire DTO shapes while expressing snapshot ownership separately from mutable result projections.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Readonly applies to nested arrays and records rather than only the outer graph array.
 * @evidence contracts/common.md#meaningful-documentation Native prose names compiler records and arrays as the supported view boundary.
 * @evidenceExclude contracts/performance.md#efficient-algorithms This mapped type has no runtime traversal; copyGraphSnapshot owns materialization.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The type describes immutable borrowing but does not coordinate repeated computation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This type acquires no runtime storage or resource.
 */
export type TtscGraphReadonly<T> = T extends readonly (infer Element)[]
  ? readonly TtscGraphReadonly<Element>[]
  : T extends object
    ? { readonly [Key in keyof T]: TtscGraphReadonly<T[Key]> }
    : T;

/**
 * Copy and freeze plain graph DTO records before retaining or exposing them.
 *
 * The caller keeps ownership of its input. Graph DTOs contain records, arrays
 * and primitive values, rather than mutable Map/Set or native handle objects.
 *
 * @evidence contracts/common.md#principled-implementation structuredClone detaches nested caller aliases before recursive freezing establishes an immutable owned fact population.
 * @evidence contracts/common.md#clear-and-simple-design One ownership boundary is shared by model and shard storage rather than separate partial field-copy lists.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Caller-owned objects are never frozen to compensate for a borrowed snapshot alias.
 * @evidence contracts/common.md#meaningful-documentation Native prose states input ownership and the plain-DTO precondition, avoiding claims about mutable native collections.
 * @evidence contracts/performance.md#efficient-algorithms One structured clone detaches the population and a WeakSet visits each owned record once during freezing; work and temporary visited storage scale with copied facts.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Model construction and shard transactions decide snapshot reuse; this ownership primitive performs one requested detachment.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Only the detached frozen result transfers to the caller; visited identities are local and no global population is retained.
 */
export function copyGraphSnapshot<T>(value: T): TtscGraphReadonly<T> {
  const owned = structuredClone(value);
  freezeRecords(owned, new WeakSet<object>());
  return owned as TtscGraphReadonly<T>;
}

/**
 * Detach frozen graph records into a caller-owned mutable DTO projection.
 *
 * @evidence contracts/common.md#principled-implementation structuredClone detaches every nested array and record before restoring the mutable wire DTO type at the ownership transfer.
 * @evidence contracts/common.md#clear-and-simple-design One inverse ownership operation keeps retained snapshots separate from editable output records.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The mutable return type is backed by a detached copy rather than a cast that exposes the retained frozen snapshot.
 * @evidence contracts/common.md#meaningful-documentation Native prose states that this operation transfers an independent mutable DTO to its caller.
 * @evidence contracts/performance.md#efficient-algorithms One structured clone copies the requested record population without repeated serialization or field-by-field intermediate copies.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The store owns continued shard reuse; a mutable output requires independent ownership rather than shared result aliases.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The detached result transfers to the caller and this helper retains no historical copies.
 */
export function copyGraphRecords<T>(value: TtscGraphReadonly<T>): T {
  return structuredClone(value) as T;
}

/** Visit each owned record once, including shared or cyclic references. */
function freezeRecords(value: unknown, visited: WeakSet<object>): void {
  if (value === null || typeof value !== "object" || visited.has(value)) return;
  visited.add(value);
  for (const child of Object.values(value)) freezeRecords(child, visited);
  Object.freeze(value);
}
