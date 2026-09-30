import fs from "node:fs";
import path from "node:path";

import {
  createNativeSessionFixture,
  processIsAlive,
  readPids,
  waitFor,
} from "../internal/nativeSession";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies aborting an active native request retires and restarts its session.
 *
 * Cancellation cannot merely reject the caller while leaving the child alive:
 * that process can still emit the cancelled frame and its protocol position is
 * no longer trusted. The same reset path as timeout must be used.
 *
 * 1. Start a first-process-only hanging fake and wait until it has claimed that
 *    role. A PID is written earlier and alone does not prove readiness.
 * 2. Abort the active graph call and assert a cancellation error.
 * 3. Assert the old child exits and a later graph call succeeds on a replacement.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphSession aborts a confirmed active hanging request even when its reason cannot be stringified, terminates the peer and answers the next request through a replacement.
 * @evidence contracts/testing.md#independent-expectations The first-marker/PID readiness proves the request is active; literal abort rejection, dead PID, empty next graph and two children are independent lifecycle observations.
 * @evidence contracts/testing.md#distinguishing-cases Active cancellation with a throwing reason contrasts later successful reuse. Queued pre-start cancellation is separately owned by queued_native_request_can_abort_before_start.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_native_request_abort_restarts_session loads the built TtscGraphSession and spawns the shared compiled Go protocol stand-in; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Actual hanging child I/O, AbortSignal handling, reason conversion and retirement/restart must connect; a synthetic promise cannot certify child termination.
 * @evidence contracts/e2e.md#shared-execution All protocol cases share the memoized Go peer build. The first-only hanging child must be cold, and the replacement is required by active abort; broader batching remains unfinished.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique readiness marker and PID logs preserve the active state before abort, finally closes the session, and explicit polling observes the original child dead.
 * @evidence contracts/e2e.md#preserved-coverage Original readiness, rejection, PID death, recovered nodes and exact two-child assertions remain, including the unprintable abort reason.
 */
export const test_ttscgraph_native_request_abort_restarts_session =
  async () => {
    const { root, session } = createNativeSessionFixture({
      mode: "hang-once",
    });
    try {
      const controller = new AbortController();
      const cancelled = session.graph({ signal: controller.signal });
      await waitFor(
        () =>
          readPids(root).length === 1 &&
          fs.existsSync(path.join(root, "first.marker")),
        "first child claim",
      );
      const firstPid = readPids(root)[0]!;
      controller.abort({
        toString(): string {
          throw new Error("unprintable cancellation reason");
        },
      });
      await assert.rejects(cancelled, /native snapshot request cancelled/);
      await waitFor(() => !processIsAlive(firstPid), "cancelled child exit");
      const graph = await session.graph();
      assert.deepEqual(graph.nodes, []);
      assert.equal(readPids(root).length, 2);
    } finally {
      session.close();
    }
  };
