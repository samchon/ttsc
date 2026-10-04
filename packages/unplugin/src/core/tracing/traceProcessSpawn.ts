import {
  type ChildProcess,
  type SpawnOptions,
  spawn,
} from "node:child_process";

import { traceInvocation } from "./traceInvocation";
import { traceNativeIncarnation } from "./traceNativeIncarnation";

/**
 * Observe one actual argument-array spawn without changing its options, return
 * value or thrown error. Start is the child's spawn event; exit and close are
 * separate observations and do not certify descendant shutdown. Call bounds
 * bracket spawn, rather than inventing an exact operating-system start time.
 * Enabled Linux starts also sample a native incarnation for a later same-view
 * observer; this does not replace the actual exit and close callbacks.
 *
 * @evidence contracts/common.md#principled-implementation
 *   One invocation correlates the actual attempt, spawn event, error, exit and
 *   close. Failed attempts and unobserved exits are not successful starts/joins.
 * @evidence contracts/common.md#clear-and-simple-design
 *   This private wrapper owns process observations; the existing caller still
 *   owns protocol decoding, refusal, references, cancellation and failure routing.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Calls the maintained spawn primitive with unchanged arguments/options and
 *   rethrows the same synchronous error; no child multiplier or foreign patch.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose states actual-start, exit/close and descendant limitations.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The supplied executable, argument array and cwd/inherited intent are retained;
 *   native PID comes from ChildProcess and availability is not guessed from OS names.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Disabled tracing delegates spawn directly. Enabled calls serialize actual
 *   argument/options observations and fixed lifecycle events, including argv bytes.
 *   Enabled Linux starts add bounded proc reads and native view metadata queries.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Actual process creation is effectful and never shared by this observer;
 *   existing process-holder callers alone decide whether to reuse a live child.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Once listeners retain the child/correlation until their events or child GC;
 *   no timer, reference change, kill or independent wait is added. Trace append
 *   handles close per event; child and descendant release remain caller-owned.
 */
export function traceProcessSpawn(
  command: string,
  args: string[],
  options: SpawnOptions,
): ChildProcess {
  const trace = traceInvocation();
  if (trace === undefined) return spawn(command, args, options);
  const startLowerBound = new Date().toISOString();
  trace("process-attempt", {
    pid: null,
    argv: [command, ...args],
    cwd: options.cwd ?? null,
    data: { cwdInherited: options.cwd === undefined },
    startLowerBound,
  });
  let child: ChildProcess;
  try {
    child = spawn(command, args, options);
  } catch (error) {
    trace("process-result", {
      pid: null,
      started: false,
      exitObserved: false,
      startLowerBound,
      startUpperBound: new Date().toISOString(),
      data: { outcome: "synchronous-spawn-error", error },
    });
    throw error;
  }
  const startUpperBound = new Date().toISOString();
  let started = false;
  let exitObserved = false;
  child.once("spawn", () => {
    started = true;
    trace("process-start", {
      pid: child.pid ?? null,
      started,
      startLowerBound,
      startUpperBound,
      data: { nativeIncarnation: traceNativeIncarnation(child.pid) },
    });
  });
  child.once("error", (error) =>
    trace("process-error", {
      pid: child.pid ?? null,
      started,
      exitObserved,
      data: { error: error.message, code: (error as NodeJS.ErrnoException).code },
    }),
  );
  child.once("exit", (status, signal) => {
    exitObserved = true;
    trace("process-exit", {
      pid: child.pid ?? null,
      started,
      exitObserved,
      status,
      signal,
    });
  });
  child.once("close", (status, signal) =>
    trace("process-close", {
      pid: child.pid ?? null,
      started,
      exitObserved,
      status,
      signal,
    }),
  );
  return child;
}
