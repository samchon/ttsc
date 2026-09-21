import fs from "node:fs";
import path from "node:path";

import type { TtscMembershipDigestRecord } from "./TtscMembershipDigestRecord";

/**
 * Write a membership record (`membershipDigestFile`) only when its bytes would
 * change, so a host's persistent cache sees the file move exactly when the
 * project's root-file membership did, and never for a rewrite of the same
 * state.
 *
 * @returns Whether the file was written.
 */
export function writeMembershipDigestFile(
  file: string,
  record: TtscMembershipDigestRecord,
): boolean {
  // Valid JSON with its keys in one order, whichever process writes it, so
  // the bytes differ only when the record does.
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
  fs.writeFileSync(file, text);
  return true;
}
