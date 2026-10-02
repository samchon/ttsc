import type { TtscGraphReadonly } from "./TtscGraphReadonly";

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
 * @evidenceExclude contracts/portability.md#os-neutral-implementation one structuredClone of in-memory records; no file, path or process is touched.
 */
export function copyGraphRecords<T>(value: TtscGraphReadonly<T>): T {
  return structuredClone(value) as T;
}
