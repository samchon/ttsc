import assert from "node:assert/strict";
import { admitted, emptyResponse, sessionState } from "./internal/sessionState";

/**
 * Verifies a failed native task waits for joined retirement before recovery.
 *
 * A numeric nonzero exit rejects work but does not make known joined release
 * unsafe. A pending release prevents overlap; a rejected release blocks retries.
 *
 * 1. Admit a graph ask, mark its port dead and supply exit(2 or 17, null).
 * 2. Require the literal exit rejection and [false, true] retirement, then keep
 *    recovery pending without admitting a replacement before release.
 * 3. Resolve release and answer a replacement, or reject an unjoined release
 *    and require repeated recovery plus terminal close to preserve failure.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual TtscGraphSessionState rejects literal exit(2, null) and exit(17, null), requests reader detach and joined release, and opens no replacement while the declared release is pending. Resolved release permits a new peer to answer an empty dump; rejected release forbids both attempted recoveries and preserves the original release Error in terminal close.
 * @evidence contracts/testing.md#independent-expectations Exit coordinates, [false, true], opener counts one/two, empty nodes and the original unjoined Error identity are authored literals. emptyResponse supplies independent typed input, not a native certificate. Deferred completion is a declared transport input, not a read of private state.
 * @evidence contracts/testing.md#distinguishing-cases Known nonzero work failure with resolved release contrasts an unjoined rejected release; both forbid replacement while pending. Repeated recovery after refusal must still fail. The separate retirement decision unit owns zero/nonzero versus signal/forced/unknown/transport qualification.
 * @evidence contracts/testing.md#execution-ownership Calls the actual source state through the suite's recorded Connection harness and typed receive; no real child, generated wire guard, pipe join, host, build or foreign method replacement is involved.
 */
export async function test_ttscgraph_exited_native_child_restarts_session(): Promise<void> {
  const failures: Error[] = [];
  for (const { code, expected } of [
    { code: 2, expected: "@ttsc/graph: native session exited (code=2, signal=null)" },
    { code: 17, expected: "@ttsc/graph: native session exited (code=17, signal=null)" },
  ]) for (const outcome of ["joined", "unjoined"] as const) {
    let release!: () => void;
    let refuse!: (error: Error) => void;
    const retirement = new Promise<void>((resolve, reject) => { release = resolve; refuse = reject; });
    const { session, ports } = sessionState(retirement);
    try {
      const active = session.graph();
      void active.catch(() => undefined);
      const port = await admitted(ports);
      port.live = false;
      port.events.exit(code, null);
      await assert.rejects(active, (error) => error instanceof Error && error.message === expected);
      assert.deepEqual(port.retirement, [false, true]);
      const recovered = session.graph();
      let settled = false;
      void recovered.then(() => { settled = true; }, () => { settled = true; });
      for (let turn = 0; turn < 20; turn++) await Promise.resolve();
      assert.equal(ports.length, 1, "replacement admitted before release");
      assert.equal(settled, false, "recovery settled before release");
      if (outcome === "joined") {
        release();
        const next = await admitted(ports);
        session.receive(next.peer, emptyResponse(Number(next.writes[0]!.id)));
        assert.deepEqual((await recovered).nodes, []);
        assert.equal(ports.length, 2);
        await session.close();
      } else {
        const unjoined = new Error("authored release could not be joined");
        refuse(unjoined);
        await assert.rejects(recovered, (error) => error === unjoined);
        await assert.rejects(session.graph(), (error) => error === unjoined);
        assert.equal(ports.length, 1);
        await assert.rejects(session.close(), (error) => error instanceof AggregateError
          && error.message === "@ttsc/graph: session shutdown failed"
          && error.errors.length === 1 && error.errors[0] === unjoined);
      }
    } catch (error) {
      failures.push(new Error(`exit ${code} ${outcome}: ${String(error)}`, { cause: error }));
    } finally {
      release();
      await session.close().catch(() => undefined);
    }
  }
  if (failures.length > 0) throw new AggregateError(failures, "exit retirement recovery matrix failed");
}
