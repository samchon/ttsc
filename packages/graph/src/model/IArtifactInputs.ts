import { IArtifactDirectory } from "./IArtifactDirectory";

/**
 * Paths an answer was derived from, split by how they are watched.
 *
 * @evidence contracts/common.md#principled-implementation Explicit files and watched directories represent edits and membership changes as distinct input populations.
 * @evidence contracts/common.md#clear-and-simple-design Two lists carry sidecar-declared provenance without a second glob interpreter or compiler dependency model.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An input inventory does not assert complete discovery provenance for a missing publisher.
 * @evidence contracts/common.md#meaningful-documentation Native property prose identifies individual files and directories that notice additions and deletions.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IArtifactInputs declares a data shape or groups members and owns no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms IArtifactInputs declares a data shape or groups members and chooses no algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work IArtifactInputs declares a data shape or groups members and coordinates no computation across requests.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation IArtifactInputs declares a data shape or groups members and performs no filesystem, path or process operation.
 */
export interface IArtifactInputs {
  /** Files stated one by one. */
  files: string[];

  /** Directories walked, which is what notices an added or deleted file. */
  directories: IArtifactDirectory[];
}
