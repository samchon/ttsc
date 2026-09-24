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
 */
export function projectRecordDigest(bytes: string | Buffer): string {
  return hashText(bytes);
}
