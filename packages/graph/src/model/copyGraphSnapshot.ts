import type { TtscGraphReadonly } from "./TtscGraphReadonly";

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
 * @evidenceExclude contracts/portability.md#os-neutral-implementation copyGraphSnapshot operates on in-memory values and performs no filesystem, path or process operation.
 */
export function copyGraphSnapshot<T>(value: T): TtscGraphReadonly<T> {
  const owned = structuredClone(value);
  freezeRecords(owned, new WeakSet<object>());
  return owned as TtscGraphReadonly<T>;
}

/** Visit each owned record once, including shared or cyclic references. */
function freezeRecords(value: unknown, visited: WeakSet<object>): void {
  if (value === null || typeof value !== "object" || visited.has(value)) return;
  visited.add(value);
  for (const child of Object.values(value)) freezeRecords(child, visited);
  Object.freeze(value);
}
