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
 *
 * @evidence contracts/common.md#principled-implementation Clearing old references before a fresh owned probe write prevents previous or rolled-back stamps from certifying content; only observed regular-file metadata establishes a same-device reference.
 * @evidence contracts/common.md#clear-and-simple-design This operation mints and records one probe stamp; input metadata comparison remains in the separability consumer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed writes, inaccessible probes, or another device cannot be replaced by Date.now or a historical maximum; actual content proof remains necessary.
 * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs explain owned storage, fresh-write evidence, and why cross-volume inputs require more reads.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral clock proof uses native owned-path writes and the observing view's bigint device/time metadata, preserving cross-volume and unavailable-probe behavior without a platform clock assumption.
 * @evidence contracts/performance.md#efficient-algorithms One write and one metadata read mint the current reference, allowing later same-device input proofs to avoid unnecessary content reads.
 * @evidence contracts/performance.md#reuse-equivalent-work The existing probe path and shared per-view reference table are reused; only a newly minted stamp can authorize signature reuse.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Refresh clears historical references and rewrites the single owned probe; generation disposal or the process-reference owner removes its directory.
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
