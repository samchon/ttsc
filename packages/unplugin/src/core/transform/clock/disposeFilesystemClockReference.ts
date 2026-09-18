import fs from "node:fs";
import path from "node:path";

/** Remove only the known probe and its now-empty owned directory. */
export function disposeFilesystemClockReference(
  referenceDirectory: string,
): void {
  try {
    fs.rmSync(path.join(referenceDirectory, "clock-reference"), {
      force: true,
    });
  } catch {
    // The probe may already have disappeared; the directory removal below is
    // still safe because it is deliberately non-recursive.
  }
  try {
    fs.rmdirSync(referenceDirectory);
  } catch {
    // Eviction schedules cleanup without awaiting its Promise. A foreign entry
    // or a concurrent removal leaves, at worst, an empty temporary directory.
  }
}
