import {
  createNativeSessionFixture,
  processIsAlive,
  readPids,
  waitFor,
} from "../internal/nativeSession";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies a queued graph request can be cancelled before native work starts.
 *
 * Serialization must not turn cancellation into another wait behind the hung
 * head request. A queued caller should reject promptly without disturbing the
 * active child whose independent caller still owns it.
 *
 * 1. Hold the queue head in a hanging native request.
 * 2. Queue a signalled second call, abort it, and assert prompt rejection.
 * 3. Assert the first child remains alive until session close and no replacement
 *    spawned.
 *
 * @evidence contracts/testing.md#behavioral-verification A queued graph request aborts in under one second while the first request hangs, leaving the sole active child alive; closing then rejects the head request.
 * @evidence contracts/testing.md#independent-expectations The elapsed bound, one PID and actual liveness distinguish immediate queue removal from cancellation that waits behind the head or kills its peer.
 * @evidence contracts/testing.md#distinguishing-cases Pre-start queued abort contrasts an active head and explicit session close. Active-request retirement is checked by the separate native_request_abort case.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_queued_native_request_can_abort_before_start loads the built TtscGraphSession and spawns the shared compiled Go protocol stand-in; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Real session queue ordering and a hanging process must interact with abort signals; an already-completed unit request cannot expose head-of-line cancellation failure.
 * @evidence contracts/e2e.md#shared-execution The shared memoized Go stand-in build produces one hanging peer reused by both requests. This controlled head/queue state needs one isolated session; full batching is incomplete.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Case-owned logs and readiness ensure the head is pending before queued abort; finally closes the session and observes/catches the head rejection, preserving no extra child.
 * @evidence contracts/e2e.md#preserved-coverage Original timing bound, active PID liveness/count and close rejection remain; no delayed polling or fake cancellation substitutes for the queue boundary.
 */
export const test_ttscgraph_queued_native_request_can_abort_before_start =
  async () => {
    const { root, session } = createNativeSessionFixture({
      mode: "hang",
    });
    const first = session.graph();
    try {
      await waitFor(() => readPids(root).length === 1, "queue head child");
      const pid = readPids(root)[0]!;
      const controller = new AbortController();
      const started = Date.now();
      const queued = session.graph({ signal: controller.signal });
      controller.abort();
      await assert.rejects(queued, /native snapshot request cancelled/);
      assert.ok(
        Date.now() - started < 1_000,
        "queued cancellation is immediate",
      );
      assert.equal(processIsAlive(pid), true);
      assert.equal(readPids(root).length, 1);
      session.close();
      await assert.rejects(first, /native session closed/);
    } finally {
      session.close();
      await first.catch(() => undefined);
    }
  };
