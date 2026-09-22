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
 * hears as well, and the next delivery replaces it whole. Every rewrite lands
 * bytes no earlier write of any process left, so a host comparing content hears
 * it as a host comparing times does.
 */
export function signalProjectRecordFile(file: string): void {
  const record = readProjectRecordFile(file);
  try {
    if (record === undefined) {
      // Only ever over a file that is there. A record is gone when its
      // project is (`refreshProjectRecordFiles`), and creating one here would
      // bring back a project's file for a project that has none, which every
      // later build start would then keep moving.
      bare += 1;
      const handle = fs.openSync(file, "r+");
      try {
        fs.writeSync(handle, `${process.pid}:${bare}`, 0, "utf8");
        fs.ftruncateSync(handle, `${process.pid}:${bare}`.length);
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
