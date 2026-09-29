import { hashText } from "../transform/utils/hashText";

/**
 * The digest of a project record's bytes (`projectRecordFile`), which stands
 * for the record's state wherever a host keeps no snapshot of the file itself.
 *
 * A record's bytes move exactly when the project's state does
 * (`writeProjectRecordFile`, `signalProjectRecordFile`), so two digests are
 * equal exactly when nothing moved the record between the two reads. Rollup's
 * cache is the host that needs it: a module it restores from the cache it was
 * handed carries the digest its delivery wrote, and the adapter compares it
 * with the record's bytes now (`createRollupCachedModuleProof`).
 *
 * @param bytes The record file's bytes, as written or as read.
 *
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
 */
export function projectRecordDigest(bytes: string | Buffer): string {
  return hashText(bytes);
}
