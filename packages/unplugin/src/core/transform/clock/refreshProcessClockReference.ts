import path from "node:path";
import { isMainThread } from "node:worker_threads";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { pathIsWithin } from "../filesystem/pathIsWithin";
import { userStateDirectory } from "../filesystem/userStateDirectory";
import { disposeFilesystemClockReference } from "./disposeFilesystemClockReference";
import { refreshFilesystemClockReference } from "./refreshFilesystemClockReference";

/**
 * Replace every prior clock proof with one reference minted in the probe
 * directory this process keeps for the proofs that hold no generation.
 *
 * A proof may let a separable signature stand for content only against a
 * reference minted before its own reads (`filesystemClockReferences`): after a
 * clock rollback a write can land in the tick of a recorded stamp, and only a
 * reference minted since the rollback puts that stamp inside it. A generation's
 * deliveries and capture mint in the probe directory the generation retains. A
 * proof that holds no generation has none: a failed generation's replay, whose
 * directory was released with it, a record's proof at a build start, and the
 * observer's proof of a plugin source.
 *
 * Those proofs run at any moment, beside compiles that observe the directories
 * around them, so minting may change nothing but the probe itself. Creating and
 * removing a directory per proof would add and remove an entry in the shared
 * temporary directory, whose metadata other observers read: the absence of a
 * `package.json` there, for one, is proven by that directory's own metadata
 * holding still while a plugin descriptor is evaluated. The probe therefore
 * lives at a process-named directory below this user's current state root
 * (`userStateDirectory`), whose provider rechecks the native layout on each
 * call; the probe is rewritten in place. A later session attempts to reclaim
 * dead-process entries when it scans that state root. The main thread registers
 * best-effort exit removal for its first successfully obtained directory. Worker
 * threads share the process id and so the directory: a probe another thread
 * rewrites between this one's write and its read is still a stamp minted before
 * this proof reads.
 *
 * Minting is an optimization's precondition, never a requirement. When the
 * directory cannot be had, either physical address cannot be resolved, or the
 * probe directory lies inside the physical `root`, every prior reference is
 * cleared anyway, so no signature is separable and the proof reads content.
 *
 * @param root The project or source the probe must lie outside.
 * @param filesystem The operations whose references the proof judges against.
 *
 * @evidence contracts/common.md#principled-implementation Detached proofs mint a fresh reference in a process-owned directory outside the observed root; unavailable or inside-root storage clears reference authority instead.
 * @evidence contracts/common.md#clear-and-simple-design The operation selects process storage then delegates the actual mint to the same reference writer used by generations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No process timestamp substitutes for a filesystem stamp, and failure preserves real content comparison without writing into the user's source tree.
 * @evidence contracts/common.md#meaningful-documentation Paragraphs explain rollback ordering, directory-entry interference, worker sharing, and exit ownership before stating unavailable-storage behavior.
 * @evidence contracts/portability.md#os-neutral-implementation The native user-state provider selects process storage; physical root and probe-directory resolution through the supplied coherent native view prevents lexical aliases from concealing containment. Unknown physical identity withdraws reference authority; observed device/time metadata qualifies cross-volume applicability.
 * @evidence contracts/performance.md#efficient-algorithms Each call pays the state provider's native path/ownership checks and two physical path resolutions before an admitted delegated probe write/lstat. Work includes path text and native observations, not a cached directory lookup; the probe is rewritten rather than opening a temporary tree per proof.
 * @evidence contracts/performance.md#reuse-equivalent-work Generation-free proofs share the same process probe and per-operation reference table while still minting before every proof that depends on separability.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The provider's process-named directory and one probe persist between detached proofs. One main-thread listener attempts removal of the first acquired directory, and later session scans attempt dead-process reclamation. Native refusal or changed state-root backing can leave entries; neither exit nor a future scan guarantees successful or timely removal.
 */
export function refreshProcessClockReference(
  root: string,
  filesystem: TtscTransformFilesystemOperations,
): void {
  const directory = processClockDirectory();
  let admitted: string | undefined;
  if (directory !== undefined) {
    try {
      const physicalRoot = filesystem.realpath(path.resolve(root));
      const physicalDirectory = filesystem.realpath(directory);
      if (!pathIsWithin(physicalDirectory, physicalRoot)) admitted = directory;
    } catch {
      // Unknown native identity cannot establish outside-root storage.
    }
  }
  refreshFilesystemClockReference(admitted, filesystem);
}

/**
 * This process's probe directory, created when absent, or `undefined` when the
 * state root cannot hold it; its removal is registered on the main thread's
 * exit the first time it is found.
 */
function processClockDirectory(): string | undefined {
  const directory = userStateDirectory(`${process.pid}-clock`);
  if (directory !== undefined && isMainThread && !exitCleanupRegistered) {
    exitCleanupRegistered = true;
    process.once("exit", () => disposeFilesystemClockReference(directory));
  }
  return directory;
}

/** Whether the main thread already removes the directory on exit. */
let exitCleanupRegistered = false;
