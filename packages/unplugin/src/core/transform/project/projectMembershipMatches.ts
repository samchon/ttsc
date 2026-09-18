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
