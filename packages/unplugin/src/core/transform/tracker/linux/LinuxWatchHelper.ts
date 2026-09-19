import type { ChildProcess } from "node:child_process";

import type { LinuxWatchHelperSubscription } from "./LinuxWatchHelperSubscription";

/**
 * The live state of the Linux watch helper, `ttsc __watch`, which owns this
 * process's directory watches (samchon/ttsc#1426).
 *
 * One helper serves the whole process over its stdio, one JSON line per request
 * or event. Requests awaiting a reply are counted, so the helper's output keeps
 * the process alive only while one is outstanding.
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
