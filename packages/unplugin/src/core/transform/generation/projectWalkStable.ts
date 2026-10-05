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
 * This predicate compares available walks and reported events rather than
 * freezing the filesystem. With no tracker, it supplies no independent A-B-A
 * event authority; complete generation admission also requires the compiler
 * graph and external/host proofs in captureTransformGeneration.
 *
 * The walks compare recorded bytes and metadata. A healthy tracker opened
 * before the compile can supply independent A-B-A event evidence: a producer
 * can restore both bytes and timestamps before the second walk, but it cannot
 * withdraw an event already recorded. This predicate accepts the records when
 * the configuration did, both walks are complete for the declared inputs, those
 * inputs kept their content and metadata, every directory that can hold a
 * program input kept its membership, and the tracker saw neither a content
 * event on a declared input nor a membership event. It reads recorded
 * event/overflow/membership fields, not tracker failed, unverified or coverage
 * state; supplying a tracker does not itself prove that every native mutation
 * was delivered. Actual backend/proof authority stays with the tracker and
 * generation-admission owners.
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
 * @evidence contracts/common.md#principled-implementation Complete walks must agree on declared content, metadata and relevant directory membership, and recorded compile-time events/overflow/membership must not refute them. Independent A-B-A authority requires a healthy, relevant backend; this predicate does not check tracker health/coverage and is not an atomic filesystem freeze or full generation proof.
 * @evidence contracts/common.md#clear-and-simple-design The verdict composes existing walk, hash, directory and event predicates without duplicating their evidence collection or tracker ownership.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown declared scope compares the full walk, omitted tracker events remain conservative, and no bundler cache filename exception replaces the actual compile-window distinction.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the temporal witness boundary and narrower role of later trackers; props identify before/after observations and undefined declared scope.
 * @evidence contracts/portability.md#os-neutral-implementation Native identity/event overlap policy stays with trackerChangedDeclaredProjectInput and the supplied filesystem observations; this predicate introduces no OS-name or separator-based case rule.
 * @evidence contracts/performance.md#efficient-algorithms Ordered conjunction short-circuits failed proof. Reached predicates scan unstable/declared or full hash populations and both full directory populations, allocating filtered maps and a relevant-path union. Event comparison resolves D declared paths and can perform C times D native/text/identity overlap work even though normal retained C is bounded. Text bytes and delegated temporary populations remain beyond witness-count bounds; no source bytes are reread here.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This pure predicate consumes an already captured pair; generation capture owns observation sharing and no cross-request cache is coordinated here.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The verdict owns no tracker, retained generation or resource lifecycle; its caller owns the compared observations.
 */
export function projectWalkStable(props: {
  /** Pre-compile walk under the primed compiler membership policy. */
  before: ProjectWalk;

  /** Whether the wrapper-dependent config view held through the compile. */
  configStable: boolean;

  /** Relevant project keys; undefined requires agreement over the whole walk. */
  declared: ReadonlySet<string> | undefined;

  /** Native project directory anchoring declared keys for event overlap. */
  projectRoot: string;

  /** Post-compile walk under the compiler-reported membership policy. */
  snapshot: ProjectWalk;

  /** Observer opened before compile; absence supplies no positive event proof. */
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
