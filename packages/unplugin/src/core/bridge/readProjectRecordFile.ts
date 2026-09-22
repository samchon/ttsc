import fs from "node:fs";

import type { TtscProjectRecord } from "./TtscProjectRecord";

/**
 * Read a project record (`projectRecordFile`) back, or nothing for a file that
 * is absent, unreadable, or not a record: such a file names no project to
 * refresh and no signal to continue, and the next delivery writes it whole.
 */
export function readProjectRecordFile(
  file: string,
): TtscProjectRecord | undefined {
  let record: unknown;
  try {
    record = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
  if (record === null || typeof record !== "object") return undefined;
  const candidate = record as Partial<TtscProjectRecord>;
  if (
    typeof candidate.tsconfig !== "string" ||
    typeof candidate.root !== "string" ||
    typeof candidate.signal !== "number" ||
    candidate.inputs === null ||
    typeof candidate.inputs !== "object" ||
    candidate.membership === undefined
  ) {
    return undefined;
  }
  return candidate as TtscProjectRecord;
}
