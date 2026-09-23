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
 * (`refreshProjectRecordFiles`). Every rewrite lands bytes no earlier write of
 * any process left, so a host comparing content hears it as a host comparing
 * times does.
 *
 * A bare signal only ever replaces a file that is there. A record is gone when
 * its project is (`refreshProjectRecordFiles`), and writing one here would
 * bring a project's file back for a project that has none.
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
