import fs from "node:fs";
import path from "node:path";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { filesystemClockReferences } from "./filesystemClockReferences";

/**
 * Replace every prior clock proof with one reference minted by a fresh write.
 *
 * The reference directory is storage the adapter already owns, deliberately
 * outside the project root, so stamping a probe file there produces a
 * freshly-minted "now" without touching the user's project — the analogue of
 * git writing its index. The probe is observed through the cache-owned
 * operations and keyed by the device those operations report, so it only ever
 * separates stamps on the filesystem that actually minted it. When its volume
 * differs from the inputs' volume, or the observed filesystem cannot see the
 * probe at all, nothing is proven and content comparison continues.
 *
 * Forcing the reference onto the inputs' volume would require writing into the
 * user's project or an otherwise unowned neighboring directory. That is not a
 * valid price for this optimization, so the cross-volume case degrades to more
 * reads instead.
 */
export function refreshFilesystemClockReference(
  referenceDirectory: string | undefined,
  filesystem: TtscTransformFilesystemOperations,
): void {
  const references = filesystemClockReferences(filesystem);
  references.clear();
  if (referenceDirectory === undefined) return;
  try {
    const probe = path.join(referenceDirectory, "clock-reference");
    fs.writeFileSync(probe, `${process.hrtime.bigint()}\n`);
    const stats = filesystem.lstat(probe);
    if (stats.isFile()) {
      references.set(stats.dev, stats.mtimeNs);
    }
  } catch {
    // A failed refresh leaves no reference, so content comparison continues.
    references.clear();
  }
}
