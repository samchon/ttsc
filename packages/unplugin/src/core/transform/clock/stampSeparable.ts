import type fs from "node:fs";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { filesystemClockReferences } from "./filesystemClockReferences";

/**
 * Test the observed modification stamp against its device's current reference.
 *
 * A strictly newer minted reference is the separation criterion used by
 * metadata-qualified content comparison. The caller owns fresh minting before
 * the relevant read and coherence of the supplied metadata/view. This predicate
 * only compares those values; it does not independently prove the mint/read
 * ordering or guarantee unchanged state after the comparison.
 *
 * @evidence contracts/common.md#principled-implementation Only a strictly later reference from the same reporting device separates the recorded modification tick; equal or absent reference cannot certify metadata-only reuse.
 * @evidence contracts/common.md#clear-and-simple-design One device lookup and bigint comparison implement the ordering criterion, leaving fresh minting and content reads with their owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Device metadata is not replaced by wall time, platform guesses, or a historical maximum that would miss same-tick writes.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes the strict observed ordering criterion from caller-owned mint/read ordering and filesystem coherence.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral separability uses the observing filesystem's bigint device and nanosecond stamp rather than assuming one timestamp granularity or system-clock origin.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Borrows the view's reference table; lazy table allocation and retained entries have the filesystemClockReferences owner, not independent state or handles here.
 * @evidenceExclude contracts/performance.md#efficient-algorithms One map lookup and one bigint comparison.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This scalar query selects no cached verdict or shared content computation; fresh-reference and content/signature reuse permission belong to the callers.
 */
export function stampSeparable(
  /** Coherent observing view that owns the current device reference. */
  filesystem: TtscTransformFilesystemOperations,
  /** Observed metadata whose native device and modification stamp are compared. */
  stats: fs.BigIntStats,
): boolean {
  const reference = filesystemClockReferences(filesystem).get(stats.dev);
  return reference !== undefined && stats.mtimeNs < reference;
}
