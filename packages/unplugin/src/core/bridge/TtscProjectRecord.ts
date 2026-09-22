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
 * against the disk and rewrites a record whose state has moved while nothing
 * ran (`refreshProjectRecordFiles`).
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
   * rule; `null` for a generation that had no walk.
   */
  membership: { digest: string; policy: ITtscProjectMembershipPolicy } | null;
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
