import type { ChildProcess } from "node:child_process";

import type { LinuxWatchHelperSubscription } from "./LinuxWatchHelperSubscription";

/**
 * The live state of the Linux watch helper, `ttsc __watch`, which owns this
 * process's directory watches (samchon/ttsc#1426).
 *
 * One helper serves the whole process over its stdio, one JSON line per request
 * or event. Requests awaiting a reply are counted, so the helper's output keeps
 * the process alive only while one is outstanding.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Shared request ids distinguish subscriptions from syncs while answered
 *   records protocol availability independently of any directory's readiness.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One helper state container supports routing and lifecycle owners; observer
 *   scope and compiler validity do not enter transport state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   An answering process is not represented as proof that every requested
 *   subscription succeeded; each subscription retains its own acknowledgment.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs and separated member comments explain shared transport
 *   and outstanding requests under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral owners see subscription callbacks; Linux process and stdio state
 *   remain behind the explicit native helper boundary.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   LinuxWatchHelper only declares a shape; it has no computation at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   LinuxWatchHelper only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   LinuxWatchHelper only declares a shape; it has no handle or retained
 *   state at runtime.
 */
export interface LinuxWatchHelper {
  /** Whether the helper has answered anything, proving it speaks the protocol. */
  answered: boolean;

  /** The helper process. */
  child: ChildProcess;

  /** Next request id, shared by subscriptions and syncs. */
  nextId: number;

  /** Replies outstanding; the output stays referenced while nonzero. */
  pending: number;

  /** Live subscriptions by id. */
  subscriptions: Map<number, LinuxWatchHelperSubscription>;

  /** Syncs awaiting their answer, each released with whether it came. */
  syncs: Map<number, (answered: boolean) => void>;
}
