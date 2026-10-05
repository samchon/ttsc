import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { PROJECT_RECORD_DIRECTORY } from "./PROJECT_RECORD_DIRECTORY";

/**
 * Whether a probe can currently be written below `toolDirectory`, observed by
 * creating the record directory and writing a file there, which is what a
 * delivery will do (samchon/ttsc#1480).
 *
 * A host that must choose record-dependent caching before any delivery, Farm
 * choosing its persistent cache at configuration time, asks this. Only a write
 * proves a directory writable: a permission check can pass where an access
 * control list, a read-only mount, or a file standing where a directory would
 * be still refuses the write. A successful probe does not promise later
 * delivery writes after permissions, mounts or directory topology change.
 *
 * @param toolDirectory A host's tool directory (`hostToolDirectory`) or its
 *   fallback (`fallbackToolDirectory`).
 * @evidence contracts/common.md#principled-implementation
 *   Creating the same record directory and writing a unique probe demonstrates
 *   the needed write capability more directly than permission-bit prediction.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One operation owns acquisition and finally-cleanup of its probe; callers
 *   receive a current observation rather than implementation-specific errors.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   PID/UUID identify a collision-resistant owned probe, not expected fixture
 *   paths; supported unwritable boundaries return false rather than bypassing them.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains why access checks are insufficient and describes the
 *   real side effect, with separated paragraphs/tags per documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Native mkdir and an actual write determine capability across permissions, ACLs and read-only mounts rather than inferring it from platform or permission bits.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Native joins scan tool-directory text; recursive mkdir visits the needed
 *   ancestor components, then one empty probe write and one removal observe
 *   capability without enumerating directory contents. Native IO is not a
 *   constant-duration operation merely because these call counts are fixed.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This observes current write capability; sharing an old answer could hide changed permissions or mount state, and the calling host owns its configuration-phase result.
 * @evidence contracts/performance.md#bound-retention-and-release-resources A unique probe is owned by this call and removed in finally on success or failure; failed native removal can leave the probe on disk, while the record directory intentionally remains for subsequent deliveries.
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
      // Cleanup is best effort; a native removal failure can leave the probe.
    }
  }
}
