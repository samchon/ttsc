import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { PROJECT_RECORD_DIRECTORY } from "./PROJECT_RECORD_DIRECTORY";

/**
 * Whether a project record can be written below `toolDirectory`, proven by
 * creating the record directory and writing a file there, which is what a
 * delivery will do (samchon/ttsc#1480).
 *
 * A host that must decide before any delivery whether its records will exist,
 * Farm choosing its persistent cache at configuration time, asks this. Only a
 * write proves a directory writable: a permission check can pass where an
 * access control list, a read-only mount, or a file standing where a directory
 * would be still refuses the write.
 *
 * @param toolDirectory A host's tool directory (`hostToolDirectory`) or its
 *   fallback (`fallbackToolDirectory`).
 */
export function projectRecordDirectoryWritable(toolDirectory: string): boolean {
  const directory = path.join(toolDirectory, PROJECT_RECORD_DIRECTORY);
  const probe = path.join(
    directory,
    `.writable-${process.pid}-${crypto.randomUUID()}`,
  );
  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(probe, "");
    return true;
  } catch {
    return false;
  } finally {
    try {
      fs.rmSync(probe, { force: true });
    } catch {
      // Never written, or removed by the time the check ends.
    }
  }
}
