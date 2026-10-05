import fs from "node:fs";

import { readProjectRecordFile } from "./readProjectRecordFile";
import { writeProjectRecordFile } from "./writeProjectRecordFile";

/** A process-local bare marker, wrapping before integer precision is lost. */
let bare = 0;

/**
 * Move a project record's bytes without a generation to write them from: a
 * watching session's bridge heard a change to an input the record names, and
 * the host is asked to deliver the project's modules again. Accepted deliveries
 * then write the record of the generation that read the change.
 *
 * The record's finite `signal` advances, wrapping to zero if adding one cannot
 * produce a distinct finite number, and the file is rewritten. A record that
 * cannot be read back is written as a bare signal, which a host comparing bytes
 * can observe as well. The next generation's delivery replaces it whole, and
 * until then a build start moves it again, since no proof can run over it
 * (`refreshProjectRecordFiles`). A readable record advances the signal this
 * process read; a bare signal includes this process's id and local sequence.
 * Concurrent writers do not share an atomic counter, so this operation does not
 * promise globally unique bytes for every attempted signal.
 *
 * A bare signal only ever replaces a file that is there. A record is gone when
 * its project is (`refreshProjectRecordFiles`), and writing one here would
 * bring a project's file back for a project that has none.
 *
 * @evidence contracts/common.md#principled-implementation A readable record preserves its project proof while choosing a distinct finite signal even beyond safe-integer precision; an unreadable existing file receives a bare marker without creating a deleted project's file.
 * @evidence contracts/common.md#clear-and-simple-design The operation uses the shared record writer for readable records and a bounded in-place write for an existing undecodable file.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A failed write cannot claim invalidation success, and process-local sequencing is not presented as an atomic cross-process counter.
 * @evidence contracts/common.md#meaningful-documentation The prose distinguishes readable and bare signals, existing-file ownership, and the concurrency limit of their content changes.
 * @evidence contracts/portability.md#os-neutral-implementation The bare branch opens a native existing record with r+ and truncates by UTF-8 byte count; the readable branch uses the shared native writer. Write and sharing failures leave invalidation unavailable, and concurrent readable writes are not atomic with project removal.
 * @evidence contracts/performance.md#efficient-algorithms Readable records decode their full input and membership populations and delegate deterministic key sorting, serialization, byte comparison and native writing. Bare markers use scalar arithmetic and short text with native open/write/truncate, without directory enumeration.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call requests a new invalidation effect, so equal return values would not permit suppressing the write as shared work.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The bare descriptor has a finally close attempt after write or truncate failure; the process marker occupies one scalar. Decoded records and serialized bytes are call-owned, and persisted record removal belongs to project refresh.
 */
export function signalProjectRecordFile(file: string): void {
  const record = readProjectRecordFile(file);
  try {
    if (record === undefined) {
      bare = bare < Number.MAX_SAFE_INTEGER ? bare + 1 : 0;
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
    const next = record.signal + 1;
    writeProjectRecordFile(file, {
      ...record,
      signal: Number.isFinite(next) && next !== record.signal ? next : 0,
    });
  } catch {
    // A record that cannot be written signals nothing. The host's next pass
    // still re-proves the generation against the filesystem.
  }
}
