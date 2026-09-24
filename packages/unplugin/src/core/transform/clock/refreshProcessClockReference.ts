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
