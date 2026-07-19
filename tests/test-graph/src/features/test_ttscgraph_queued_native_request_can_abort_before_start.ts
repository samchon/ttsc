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
 */
export const test_ttscgraph_queued_native_request_can_abort_before_start =
  async () => {
    const { root, session } = createNativeSessionFixture({
      mode: "hang",
      requestTimeoutMs: 10_000,
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
