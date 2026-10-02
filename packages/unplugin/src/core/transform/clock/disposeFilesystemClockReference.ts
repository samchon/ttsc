import fs from "node:fs";
import path from "node:path";

/**
 * Attempt removal of the known probe and its now-empty owned directory.
 *
 * @evidence contracts/common.md#principled-implementation Cleanup attempts the known probe then nonrecursive directory removal, preserving any foreign or concurrently added entry.
 * @evidence contracts/common.md#clear-and-simple-design Two independent removal attempts target owned file/directory storage without a recursive cleanup policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A failure cannot justify deleting unknown contents or leaving a rejected cleanup promise behind.
 * @evidence contracts/common.md#meaningful-documentation The comment identifies the ownership limit, and internal comments explain independent attempts and nonrecursive preservation.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral cleanup uses native path joining and filesystem removal, tolerating missing or busy resources without hardcoded temporary roots.
 * @evidence contracts/performance.md#efficient-algorithms Cleanup performs two native removal attempts with path-text joining cost, rather than scanning or recursively deleting a tree; syscall duration remains native filesystem work.
 * @evidence contracts/performance.md#reuse-equivalent-work This is the shared disposal operation for retained generation and process clock probes, avoiding separate cleanup policies.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Both removal failures are consumed with no retained retry task. Only an empty directory may be removed; a busy probe, permissions or foreign contents can leave residual storage after ownership cleanup. Repeated attempts preserve the same nonrecursive boundary.
 */
export function disposeFilesystemClockReference(
  /** Owned reference storage; unknown children must survive cleanup failure. */
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
    // or native removal failure can leave residual storage; never remove unknown
    // contents to make a cleanup attempt appear successful.
  }
}
