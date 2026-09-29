import type { TtscWatchInputEvidence } from "../transform/watch/TtscWatchInputEvidence";
import type { ITtscProjectMembershipPolicy } from "../tsconfig/ITtscProjectMembershipPolicy";

/**
 * What a project record file holds (`projectRecordFile`): the state of the
 * project the generation that wrote it was compiled from, as the evidence of
 * every input the compile consulted and the digest of the root files the
 * adapter's walk admitted.
 *
 * The file is the project's state as one file. A generation is a compile of the
 * whole project, so every module's output is a function of that state and
 * nothing finer; a host therefore records this one file, beside the module
 * itself, and its own snapshot or watcher decides when the module runs again.
 * The bytes move exactly when the state does: a delivery writes the record of
 * its generation (`writeProjectRecordFile`), a watching session's bridge bumps
 * `signal` when an observer reports a change to a recorded input
 * (`signalProjectRecordFile`), and a build start proves each recorded input
 * against the disk and moves a record whose state has moved while nothing ran
 * or that it cannot read, and removes one whose tsconfig is gone
 * (`refreshProjectRecordFiles`).
 *
 * @evidence contracts/common.md#principled-implementation
 *   Input evidence and separate membership policy express the generation's
 *   file/predicate and root-population dependencies; signal changes record bytes
 *   without claiming that an observer already owns a new generation.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One persisted project record is the host's dependency boundary rather than
 *   exposing every compiler input through incompatible host watcher APIs.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Signals encode actual observed changes; the record contains no fabricated
 *   compiler output or consumer-specific expected state.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs and spaced members explain persistence, membership-null
 *   meaning and signal purpose under the documentation skill.
 */
export interface TtscProjectRecord {
  /**
   * Every input the generation consulted, keyed by absolute path, with the
   * state the generation recorded for it. An input whose generation recorded no
   * state, a failed compile's recovery input among them, carries the state the
   * adapter read when it wrote the record.
   */
  inputs: Record<string, TtscWatchInputEvidence>;

  /**
   * The root files the adapter's walk admitted, as `membershipRecordDigest`
   * digests them under the policy stored beside it, so a refresh walks the same
   * rule, with every directory the walk entered, as the membership input a
   * delivery hands a watching observer carries it (`projectMembershipInput`);
   * `null` for a generation that had no walk.
   */
  membership: {
    digest: string;
    directories: readonly string[];
    policy: ITtscProjectMembershipPolicy;
  } | null;

  /** The project root the walk starts from and every input lies below or beside. */
  root: string;

  /**
   * How many times a watching session signalled a change since the record was
   * last written from a generation. The number carries no meaning of its own;
   * it moves the bytes for a host that compares them.
   */
  signal: number;

  /** The tsconfig the record belongs to, as the adapter names it. */
  tsconfig: string;
}
