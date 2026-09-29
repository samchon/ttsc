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
 * lives in one directory per process below this user's state root
 * (`userStateDirectory`), created once and rewritten in place. It is named by
 * the process id, as every per-process entry there is, so a process that dies
 * without removing it has it removed by the next session that opens there
 * (`openTtscTransformSession`); the main thread removes it on exit. Worker
 * threads share the process id and so the directory: a probe another thread
 * rewrites between this one's write and its read is still a stamp minted before
 * this proof reads.
 *
 * Minting is an optimization's precondition, never a requirement. When the
 * directory cannot be had, or lies inside `root`, every prior reference is
 * cleared anyway, so no signature is separable and the proof reads content.
 *
 * @param root The project or source the probe must lie outside.
 * @param filesystem The operations whose references the proof judges against.
 *
 * @evidence contracts/common.md#principled-implementation Detached proofs mint a fresh reference in a process-owned directory outside the observed root; unavailable or inside-root storage clears reference authority instead.
 * @evidence contracts/common.md#clear-and-simple-design The operation selects process storage then delegates the actual mint to the same reference writer used by generations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No process timestamp substitutes for a filesystem stamp, and failure preserves real content comparison without writing into the user's source tree.
 * @evidence contracts/common.md#meaningful-documentation Paragraphs explain rollback ordering, directory-entry interference, worker sharing, and exit ownership before stating unavailable-storage behavior.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral storage comes from the shared user-state provider and native containment; filesystem device/time metadata determines whether a reference applies across volumes.
 * @evidence contracts/performance.md#efficient-algorithms Each proof reuses one process directory and performs one delegated probe mint instead of creating and removing temporary trees per validation.
 * @evidence contracts/performance.md#reuse-equivalent-work Generation-free proofs share the same process probe and per-operation reference table while still minting before every proof that depends on separability.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One process directory is cleaned by the main-thread exit listener; crashed-process directories are reclaimed by subsequent session opening.
 */
export function refreshProcessClockReference(
  root: string,
  filesystem: TtscTransformFilesystemOperations,
): void {
  const directory = processClockDirectory();
  refreshFilesystemClockReference(
    directory === undefined || pathIsWithin(directory, path.resolve(root))
      ? undefined
      : directory,
    filesystem,
  );
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
