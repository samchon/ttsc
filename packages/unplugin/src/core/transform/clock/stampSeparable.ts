import type fs from "node:fs";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { filesystemClockReferences } from "./filesystemClockReferences";

/**
 * Report whether a later write to the observed path is guaranteed to move its
 * modification stamp: the device's current probe holds a stamp strictly newer,
 * so the tick that minted the stamp is provably over. The probe was written
 * before the caller's content read began, which is the ordering the guarantee
 * needs — a stamp minted before the read proves every post-read write lands in
 * a newer tick.
 *
 * @evidence contracts/common.md#principled-implementation Only a strictly later reference from the same reporting device separates the recorded modification tick; equal or absent reference cannot certify metadata-only reuse.
 * @evidence contracts/common.md#clear-and-simple-design One device lookup and bigint comparison implement the ordering criterion, leaving fresh minting and content reads with their owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Device metadata is not replaced by wall time, platform guesses, or a historical maximum that would miss same-tick writes.
 * @evidence contracts/common.md#meaningful-documentation The native paragraph explains strict ordering and the prerequisite that reference minting precede the content read.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral separability uses the observing filesystem's bigint device and nanosecond stamp rather than assuming one timestamp granularity or system-clock origin.
 */
export function stampSeparable(
  filesystem: TtscTransformFilesystemOperations,
  stats: fs.BigIntStats,
): boolean {
  const reference = filesystemClockReferences(filesystem).get(stats.dev);
  return reference !== undefined && stats.mtimeNs < reference;
}
