import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import type { TtscWatchInputState } from "../watch/TtscWatchInputState";
import { projectMembershipDigest } from "./projectMembershipDigest";
import { walkProjectInputs } from "./walkProjectInputs";

/**
 * Whether a project's root-file membership still equals what a generation
 * recorded (samchon/ttsc#1419).
 *
 * The project is walked again under the recorded policy, the same walk the
 * transform proves a generation with, and its digest compared. A walk that
 * could not observe every directory coherently cannot prove anything, so it
 * answers `false`: the host re-runs the module, and the transform decides.
 *
 * @param root The project root the membership belongs to.
 * @param state The recorded membership.
 * @param filesystem The filesystem to walk.
 *
 * @evidence contracts/common.md#principled-implementation Re-enumeration under the recorded policy must be complete before its membership digest may equal the captured value; an incomplete walk cannot authorize reuse.
 * @evidence contracts/common.md#clear-and-simple-design The operation delegates enumeration and digest construction to their existing owners and combines only completeness with identity comparison.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A matching partial directory set or quiet watcher is not substituted for a coherent membership observation.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state the recorded-policy premise and conservative false result on incomplete observation; parameter tags identify the root, state and filesystem seam.
 * @evidence contracts/portability.md#os-neutral-implementation The same injected native filesystem view is used for re-enumeration, while recorded policy preserves the compiler's case and root rules; this comparison introduces no separate platform assumptions.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Walk results live only through this comparison and no handle, task or historical snapshot is retained here.
 * @evidence contracts/performance.md#efficient-algorithms One complete walk feeds one digest comparison, and incompleteness short-circuits digest construction; traversal and sorting costs remain those of the shared walk and digest owners.
 * @evidence contracts/performance.md#reuse-equivalent-work The recorded policy and digest are reused as the comparison target, but current membership is reobserved; callers can use valid event evidence to avoid invoking this full fallback.
 */
export function projectMembershipMatches(
  root: string,
  state: Extract<TtscWatchInputState, { codec: "membership" }>,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): boolean {
  const walked = walkProjectInputs(root, filesystem, state.policy);
  return (
    walked.complete &&
    projectMembershipDigest(state.policy, walked.directories) === state.digest
  );
}
