import { IArtifactDirectory } from "./IArtifactDirectory";

/**
 * Paths an answer was derived from, split by how they are watched.
 *
 * @evidence contracts/common.md#principled-implementation Explicit files and watched directories represent edits and membership changes as distinct input populations.
 * @evidence contracts/common.md#clear-and-simple-design Two lists carry sidecar-declared provenance without a second glob interpreter or compiler dependency model.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An input inventory does not assert complete discovery provenance for a missing publisher.
 * @evidence contracts/common.md#meaningful-documentation Native property prose identifies individual files and directories that notice additions and deletions.
 */
export interface IArtifactInputs {
  /** Files stated one by one. */
  files: string[];

  /** Directories walked, which is what notices an added or deleted file. */
  directories: IArtifactDirectory[];
}
