import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createTransformScratchDirectory } from "../tsconfig/createTransformScratchDirectory";
import { disposeFilesystemClockReference } from "./disposeFilesystemClockReference";
import { refreshFilesystemClockReference } from "./refreshFilesystemClockReference";

/**
 * Replace every prior clock proof with one reference minted in a scratch
 * directory outside `root`, removed again before this returns.
 *
 * A proof may let a separable signature stand for content only against a
 * reference minted before its own reads (`filesystemClockReferences`): after a
 * clock rollback a write can land in the tick of a recorded stamp, and only a
 * reference minted since the rollback puts that stamp inside it. A generation's
 * deliveries and capture mint in the probe directory the generation retains. A
 * proof that holds no generation has none: a failed generation's replay, whose
 * directory was released with it, a record's proof at a build start, and the
 * observer's proof of a plugin source. Each of those mints here, in the
 * adapter-owned scratch storage a compile uses
 * (`createTransformScratchDirectory`), never in the project. The reference is
 * the stamp the probe was given, so it outlives the directory.
 *
 * Minting is an optimization's precondition, never a requirement: when no
 * scratch directory can be created, every prior reference is cleared anyway, so
 * no signature is separable and the proof reads content.
 *
 * @param root The project or source the scratch directory must lie outside.
 * @param filesystem The operations whose references the proof judges against.
 */
export function refreshScratchClockReference(
  root: string,
  filesystem: TtscTransformFilesystemOperations,
): void {
  let directory: string;
  try {
    directory = createTransformScratchDirectory(root, filesystem);
  } catch {
    refreshFilesystemClockReference(undefined, filesystem);
    return;
  }
  try {
    refreshFilesystemClockReference(directory, filesystem);
  } finally {
    disposeFilesystemClockReference(directory);
  }
}
