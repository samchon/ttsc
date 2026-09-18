import type { collectProjectInputSnapshot } from "../project/collectProjectInputSnapshot";
import type { TtscProjectMutationTracker } from "../tracker/TtscProjectMutationTracker";
import { sameHashes } from "../validation/sameHashes";
import { sameProjectDirectories } from "../validation/sameProjectDirectories";
import { walkSnapshotComplete } from "../validation/walkSnapshotComplete";
import { trackerChangedDeclaredProjectInput } from "./trackerChangedDeclaredProjectInput";

/**
 * Whether the project held still across one compile, the half of a capture's
 * verdict that only evidence spanning the compile can decide
 * (samchon/ttsc#1383).
 *
 * The walks before and after the compile prove bytes and metadata, and the
 * tracker opened before the compile is the independent A-B-A witness: a
 * producer can restore both bytes and timestamps before the second walk, but it
 * cannot withdraw an event already queued. So the project held still only when
 * the configuration did, both walks are complete for the declared inputs, those
 * inputs kept their content and metadata, every directory that can hold a
 * program input kept its membership, and the tracker saw neither a content
 * event on a declared input nor a membership event.
 *
 * That tracker is the only one accepted. The host-input and candidate trackers
 * open after the compile returns, so they never saw what it read. A change in
 * their window before the capture's own reads is visible to those reads, and a
 * change after them stays queued as a path witness for the next delivery. Their
 * events used to fail the attempt anyway, which turned `vitest` writing its
 * cache under `node_modules` beside a dev server into a terminal "could not
 * capture a reusable transform generation" error.
 *
 * @param props.before The project walk taken before the compile.
 * @param props.configStable Whether the configuration held still.
 * @param props.declared The generation's declared project inputs, or
 *   `undefined` for an envelope that declares none, which compares the whole
 *   walk.
 * @param props.projectRoot The root the declared keys are relative to.
 * @param props.snapshot The project walk taken after the compile.
 * @param props.tracker The project tracker opened before the compile, if one
 *   could be opened.
 */
export function projectWalkStable(props: {
  before: ProjectWalk;
  configStable: boolean;
  declared: ReadonlySet<string> | undefined;
  projectRoot: string;
  snapshot: ProjectWalk;
  tracker: TtscProjectMutationTracker | undefined;
}): boolean {
  return (
    props.configStable &&
    walkSnapshotComplete(props.before, props.declared) &&
    walkSnapshotComplete(props.snapshot, props.declared) &&
    sameHashes(props.before.hashes, props.snapshot.hashes, props.declared) &&
    sameHashes(
      props.before.fileSignatures,
      props.snapshot.fileSignatures,
      props.declared,
    ) &&
    sameProjectDirectories(
      props.before.projectDirectories,
      props.snapshot.projectDirectories,
    ) &&
    !trackerChangedDeclaredProjectInput(
      props.tracker,
      props.declared,
      props.projectRoot,
    ) &&
    props.tracker?.membershipChanged !== true
  );
}

/** The parts of a project walk the verdict compares. */
type ProjectWalk = Pick<
  ReturnType<typeof collectProjectInputSnapshot>,
  | "complete"
  | "directoryComplete"
  | "fileSignatures"
  | "hashes"
  | "projectDirectories"
  | "unstableFiles"
>;
