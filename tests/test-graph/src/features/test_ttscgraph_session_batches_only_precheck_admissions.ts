import assert from "node:assert/strict";

import { admitted, emptyResponse, sessionState } from "./internal/sessionState";

/**
 * Verifies callers share a freshness check only when admitted before it starts.
 *
 * 1. Admit two callers together, then add two during asynchronous artifact
 *    validation, before the native request is written.
 * 2. Publish the first generation and require the late pair to await a second
 *    request instead of receiving the first answer.
 * 3. Publish an unchanged answer and require each pair to share its result.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual graph admission writes one native request per precheck group; late callers remain unsettled until their own reply, and both original callers receive the same immutable graph.
 * @evidence contracts/testing.md#independent-expectations Two writes for four authored calls follow the admission-before-check contract. No response is sent for the second group until its unsettled state is observed.
 * @evidence contracts/testing.md#distinguishing-cases Simultaneous admissions share, calls during asynchronous artifact preparation do not join a refresh that has started even before its native write, a group queued behind active work shares its later check, and unchanged response reuses the model without suppressing validation.
 * @evidence contracts/testing.md#execution-ownership Calls TtscGraphSessionState against the existing recorded transport; no native process, compiler build or installed consumer runs.
 */
export async function test_ttscgraph_session_batches_only_precheck_admissions(): Promise<void> {
  let release!: () => void;
  const validation = new Promise<void>((resolve) => { release = resolve; });
  let started!: () => void;
  const validating = new Promise<void>((resolve) => { started = resolve; });
  const { session, ports } = sessionState(undefined, async () => {
    started();
    await validation;
  });
  try {
    const first = session.graph();
    const second = session.graph();
    await validating;
    assert.equal(ports.length, 0);
    let lateSettled = false;
    const late = session.graph();
    const lateOther = session.graph();
    void late.then(() => { lateSettled = true; });
    release();
    const port = await admitted(ports);
    session.receive(port.peer, emptyResponse(Number(port.writes[0]!.id)));
    const initial = await first;
    assert.equal(await second, initial);
    await admitted(ports, 2);
    assert.equal(lateSettled, false);
    assert.equal(port.writes.length, 2);
    session.receive(port.peer, emptyResponse(Number(port.writes[1]!.id), false));
    assert.equal(await late, initial);
    assert.equal(await lateOther, initial);
    assert.equal(port.writes.length, 2);
  } finally {
    release();
    await session.close();
  }
}
