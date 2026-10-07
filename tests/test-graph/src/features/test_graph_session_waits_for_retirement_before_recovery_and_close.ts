import assert from "node:assert/strict";

import { TtscGraphProtocol } from "../../../../packages/graph/src/model/TtscGraphProtocol";
import { TtscGraphSessionState } from "../../../../packages/graph/src/model/TtscGraphSessionState";

/**
 * Verifies graph ownership waits for a retired transport's release.
 *
 * Request failure is immediate, but recovery and terminal release need the
 * declared transport completion. A rejected release never admits a
 * replacement.
 *
 * 1. Admit a request and supply an explicit caller-owned failure event.
 * 2. Keep its release pending and assert recovery opens no replacement.
 * 3. Resolve or reject release, checking terminal idempotence and failure truth.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual state admission rejects the first request while replacement and close wait for the declared release promise; a rejected release blocks replacement and rejects close.
 * @evidence contracts/testing.md#independent-expectations Deferred promises are authored operation inputs, with literal opener counts and errors independently defining release ordering; no native response is synthesized.
 * @evidence contracts/testing.md#distinguishing-cases Successful pending release and rejected release preserve separate recovery outcomes; repeated close shares one promise and future graph calls reject.
 * @evidence contracts/testing.md#execution-ownership The matching src/features entry directly runs the owning state with declared transport operations, without OS children, installation or native build.
 */
export async function test_graph_session_waits_for_retirement_before_recovery_and_close(): Promise<void> {
  const failures: Error[] = [];
  for (const outcome of ["resolved", "rejected"] as const) {
    let release!: () => void;
    let refuse!: (error: Error) => void;
    const retirement = new Promise<void>((resolve, reject) => {
      release = resolve;
      refuse = reject;
    });
    let opens = 0;
    let fail!: () => void;
    const state = new TtscGraphSessionState({
      beforeRequest: async () => undefined,
      artifacts: () => "",
      decode: TtscGraphProtocol.decode,
      close: () => undefined,
      open: (events) => {
        opens++;
        fail = () => events.error(new Error("authored transport failure"));
        return {
          stderr: "",
          alive: () => true,
          write: (_line, done) => done(),
          close: (terminate) => (terminate ? retirement : undefined),
        };
      },
    });
    try {
      const active = state.graph();
      for (let turn = 0; turn < 10 && opens === 0; turn++)
        await Promise.resolve();
      assert.equal(opens, 1);
      fail();
      await assert.rejects(active, /authored transport failure/);
      const recovery = state.graph();
      void recovery.catch(() => undefined);
      for (let turn = 0; turn < 10; turn++) await Promise.resolve();
      assert.equal(opens, 1, "pending release must not open another process");
      const closing = state.close();
      assert.equal(state.close(), closing);
      let joined = false;
      void closing.then(
        () => {
          joined = true;
        },
        () => undefined,
      );
      await Promise.resolve();
      assert.equal(joined, false);
      if (outcome === "resolved") release();
      else refuse(new Error("authored release failure"));
      await assert.rejects(
        recovery,
        outcome === "resolved"
          ? /session is closed/
          : /authored release failure/,
      );
      if (outcome === "resolved") await closing;
      else await assert.rejects(closing, /session shutdown failed/);
      assert.equal(opens, 1);
      await assert.rejects(state.graph(), /session is closed/);
    } catch (error) {
      failures.push(
        new Error(`${outcome}: ${String(error)}`, { cause: error }),
      );
    } finally {
      release();
      await state.close().catch(() => undefined);
    }
  }
  if (failures.length > 0)
    throw new AggregateError(failures, "retirement ownership matrix failed");
}
