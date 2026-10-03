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
 * The write uses the native host filesystem; the supplied observing view must
 * coherently observe that probe for its metadata to represent this mint. This
 * function does not independently certify equivalence of a replaced view.
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
 * @evidence contracts/performance.md#efficient-algorithms
 *   Clear the view's prior entries, then an available directory performs native
 *   path joining, one write of process-counter text and one observed metadata
 *   read. Costs include path/counter text and native I/O; a missing directory
 *   skips I/O. Clearing/recording follows the current reference population,
 *   not a scan of project inputs.
 * @evidence contracts/performance.md#reuse-equivalent-work The existing probe path and shared per-view reference table are reused; only a newly minted stamp can authorize signature reuse.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Refresh clears history and retains at most one regular-file device stamp;
 *   failure leaves an empty reference table. The single probe persists in its
 *   generation/process-owned directory until that owner attempts cleanup;
 *   this refresh acquires no separate handle or retry task.
 */
export function refreshFilesystemClockReference(
  /** Owned probe storage, or unavailable storage requiring reference withdrawal. */
  referenceDirectory: string | undefined,
  /** Coherent observing view whose device/time reference will be replaced. */
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
