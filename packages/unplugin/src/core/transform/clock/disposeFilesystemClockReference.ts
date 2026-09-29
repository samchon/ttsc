import fs from "node:fs";
import path from "node:path";

/**
 * Remove only the known probe and its now-empty owned directory.
 *
 * @evidence contracts/common.md#principled-implementation Cleanup removes the known probe then attempts nonrecursive directory removal, preserving any foreign or concurrently added entry.
 * @evidence contracts/common.md#clear-and-simple-design Two independent removal attempts release the owned file and directory without a recursive cleanup policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A failure cannot justify deleting unknown contents or leaving a rejected cleanup promise behind.
 * @evidence contracts/common.md#meaningful-documentation The comment identifies the ownership limit, and internal comments explain independent attempts and nonrecursive preservation.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral cleanup uses native path joining and filesystem removal, tolerating missing or busy resources without hardcoded temporary roots.
 * @evidence contracts/performance.md#efficient-algorithms Cleanup performs bounded operations on the single known probe and its directory rather than scanning or recursively deleting a tree.
 * @evidence contracts/performance.md#reuse-equivalent-work This is the shared disposal operation for retained generation and process clock probes, avoiding separate cleanup policies.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The owned probe is removed and only an empty directory can be removed; repeated or partially completed cleanup remains harmless.
 */
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
