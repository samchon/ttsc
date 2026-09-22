import fs from "node:fs";
import path from "node:path";

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
      fs.mkdirSync(path.dirname(file), { recursive: true });
      bare += 1;
      fs.writeFileSync(file, `${process.pid}:${bare}`);
      return;
    }
    writeProjectRecordFile(file, { ...record, signal: record.signal + 1 });
  } catch {
    // A record that cannot be written signals nothing. The host's next pass
    // still re-proves the generation against the filesystem.
  }
}
