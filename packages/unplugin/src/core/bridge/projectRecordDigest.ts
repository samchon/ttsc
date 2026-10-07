import { hashText } from "../transform/utils/hashText";

/**
 * The digest of a project record's bytes (`projectRecordFile`), which stands
 * for the record's state wherever a host keeps no snapshot of the file itself.
 *
 * Deliveries and repeated retry signals can move record bytes
 * (`writeProjectRecordFile`, `signalProjectRecordFile`). The digest compares
 * sampled content, not every intermediate write; equal samples do not prove no
 * intervening change, and SHA-256 is a fingerprint rather than equality without
 * collision assumptions. Rollup's cache is the host that needs it: a module it
 * restores from the cache it was handed carries the digest its delivery wrote,
 * and the adapter compares it with the record's bytes now
 * (`createRollupCachedModuleProof`).
 *
 * @param bytes The record file's bytes, as written or as read.
 * @evidence contracts/common.md#principled-implementation
 *   The shared content hash fingerprints the bytes the host records; matching
 *   serialization, rather than object identity, makes cross-process comparison possible.
 * @evidence contracts/common.md#clear-and-simple-design
 *   A named wrapper separates record-byte identity from generation input digests.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Digests derive from actual written/read bytes rather than expected project states.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains the cache consumer and byte ownership, with separated
 *   paragraphs and tags as documentation guidance requires.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Digesting acquires and retains no handle, task or state.
 * @evidence contracts/performance.md#efficient-algorithms One SHA-256 pass over the record's bytes, linear in their length.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A pure digest of the bytes supplied; whether a digest may stand for a record is decided by the Rollup proof that calls it.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Hashes bytes it is given; no path, filesystem or process value is read.
 */
export function projectRecordDigest(bytes: string | Buffer): string {
  return hashText(bytes);
}
