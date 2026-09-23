import fs from "node:fs";

import type { TtscProjectRecord } from "./TtscProjectRecord";

/**
 * Read a project record (`projectRecordFile`) back, or nothing for a file that
 * is absent, unreadable, or not a record: such a file names no project and no
 * signal to continue. A build start moves one that is there, since no proof can
 * run over it (`refreshProjectRecordFiles`), and the next generation's delivery
 * writes it whole.
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
    candidate.membership === undefined ||
    (candidate.membership !== null &&
      (typeof candidate.membership.digest !== "string" ||
        !Array.isArray(candidate.membership.directories) ||
        candidate.membership.policy === null ||
        typeof candidate.membership.policy !== "object"))
  ) {
    return undefined;
  }
  return candidate as TtscProjectRecord;
}
