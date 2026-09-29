import fs from "node:fs";

import { readProjectRecordFile } from "./readProjectRecordFile";
import { writeProjectRecordFile } from "./writeProjectRecordFile";

/** How many bare signals this process has written, so no two read alike. */
let bare = 0;

/**
 * Move a project record's bytes without a generation to write them from: a
 * watching session's bridge heard a change to an input the record names, and
 * the host must run the project's modules again, whose deliveries then write
 * the record of the generation that read the change.
 *
 * The record's `signal` is incremented and the file rewritten. A record that
 * cannot be read back is written as a bare signal, which a host comparing bytes
 * hears as well. The next generation's delivery replaces it whole, and until
 * then a build start moves it again, since no proof can run over it
 * (`refreshProjectRecordFiles`). A readable record advances the signal this
 * process read; a bare signal includes this process's id and local sequence.
 * Concurrent writers do not share an atomic counter, so this operation does
 * not promise globally unique bytes for every attempted signal.
 *
 * A bare signal only ever replaces a file that is there. A record is gone when
 * its project is (`refreshProjectRecordFiles`), and writing one here would
 * bring a project's file back for a project that has none.
 *
 * @evidence contracts/common.md#principled-implementation A readable record preserves its project proof while advancing the observed signal; an unreadable existing file receives a bare signal without creating a deleted project's file.
 * @evidence contracts/common.md#clear-and-simple-design The operation uses the shared record writer for readable records and a bounded in-place write for an existing undecodable file.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A failed write cannot claim invalidation success, and process-local sequencing is not presented as an atomic cross-process counter.
 * @evidence contracts/common.md#meaningful-documentation The prose distinguishes readable and bare signals, existing-file ownership, and the concurrency limit of their content changes.
 * @evidence contracts/portability.md#os-neutral-implementation Native r+ opens only an existing host record and truncates by UTF-8 byte count; platform write and sharing failures leave invalidation unavailable rather than recreating a removed project.
 * @evidence contracts/performance.md#efficient-algorithms Readable records use one decode and the shared deterministic writer; undecodable files receive a short process-local signal without directory enumeration.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call requests a new invalidation effect, so equal return values would not permit suppressing the write as shared work.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The bare-signal descriptor closes in finally after write or truncate failure; only a constant-size process sequence remains resident, and persisted record removal belongs to project refresh.
 */
export function signalProjectRecordFile(file: string): void {
  const record = readProjectRecordFile(file);
  try {
    if (record === undefined) {
      bare += 1;
      const text = `${process.pid}:${bare}`;
      // `r+` and not a write that creates: a file that is gone stays gone,
      // whichever process removed it between the read above and here.
      const handle = fs.openSync(file, "r+");
      try {
        fs.writeSync(handle, text, 0, "utf8");
        fs.ftruncateSync(handle, Buffer.byteLength(text));
      } finally {
        fs.closeSync(handle);
      }
      return;
    }
    writeProjectRecordFile(file, { ...record, signal: record.signal + 1 });
  } catch {
    // A record that cannot be written signals nothing. The host's next pass
    // still re-proves the generation against the filesystem.
  }
}
