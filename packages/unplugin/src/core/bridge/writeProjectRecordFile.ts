import fs from "node:fs";
import path from "node:path";

import type { TtscProjectRecord } from "./TtscProjectRecord";

/**
 * Write a project record (`projectRecordFile`) only when its bytes would
 * change, so a host comparing the file's content or time sees it move exactly
 * when the project's state did, and never for a rewrite of the same state.
 *
 * The record is valid JSON with its keys in one order, whichever process writes
 * it, so two generations of one state produce one byte sequence.
 *
 * The bytes go into the file the host watches rather than into a replacement of
 * it; the comment below the comparison says why, what that costs, and what
 * answers it.
 *
 * @returns Whether the file was written.
 */
export function writeProjectRecordFile(
  file: string,
  record: TtscProjectRecord,
): boolean {
  const text = JSON.stringify(record, (_key, value: unknown) =>
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.keys(value as Record<string, unknown>)
            .sort()
            .map((key) => [key, (value as Record<string, unknown>)[key]]),
        )
      : value,
  );
  try {
    if (fs.readFileSync(file, "utf8") === text) return false;
  } catch {
    // Absent or unreadable: written below.
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // In place, into the file the host is watching, never beside it and over
  // it. A host watches the record by its path, and replacing the path's file
  // detaches a watcher that holds the one behind it: Rollup's, whose own
  // source says a file "unlinked and immediately recreated would create a
  // change event but then no longer any further events" on Linux, and whose
  // re-arm loses the watch for good when a replacement lands inside it
  // (measured: six moves of the record, seventeen seconds, not one of them
  // reported, while the adapter's own observer had heard the edit).
  //
  // A reader can therefore catch the file mid-write, and so can a second
  // writer. Two processes holding one generation write the same bytes, since
  // the record is a function of the project's state; two holding different
  // ones can leave a mix, which reads as no record. Both are answered where
  // the record is read rather than here: a record that cannot be read counts
  // as a record whose state moved (`refreshProjectRecordFiles`), which is the
  // answer a proof that cannot run already gives, and costs at most one
  // rebuild the host did not need.
  fs.writeFileSync(file, text);
  return true;
}
