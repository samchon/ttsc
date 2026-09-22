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
  // Whole or not at all: a host hashing the record while it is written would
  // take a torn read for a change, and a worker of a pool reading it back
  // would take it for no record. The bytes land beside the file and replace
  // it in one step; where the replacement is refused, Windows with the file
  // open elsewhere, the bytes are written in place, which is at most one
  // rebuild the host did not need.
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, text);
    fs.renameSync(temporary, file);
  } catch {
    fs.rmSync(temporary, { force: true });
    fs.writeFileSync(file, text);
  }
  return true;
}
