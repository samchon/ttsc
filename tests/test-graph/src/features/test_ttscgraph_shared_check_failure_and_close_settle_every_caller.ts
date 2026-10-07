import assert from "node:assert/strict";

import {
  admitted,
  assertRetired,
  emptyResponse,
  sessionState,
} from "./internal/sessionState";

/**
 * Verifies shared refresh failure and shutdown settle all live callers once.
 *
 * 1. Fail the native answer of two precheck admissions and require both errors.
 * 2. Recover through a new check on the existing peer with a full generation.
 * 3. Close during another shared check and require both closed errors and one
 *    native retirement.
 *
 * @evidence contracts/testing.md#behavioral-verification Native error replies reject both shared graph callers; subsequent demand requires another write and recovers, while terminal close rejects both new consumers and retires their one peer.
 * @evidence contracts/testing.md#independent-expectations The explicit error envelope carries no graph, so neither caller may succeed. A later authored full dump is the only successful generation; literal write and port counts distinguish retry from cached failure or duplicated producer work.
 * @evidence contracts/testing.md#distinguishing-cases Error without a current model contrasts successful recovery on the same transport; close of a shared active check contrasts ordinary reply settlement and independent cancellation covered by sibling cases.
 * @evidence contracts/testing.md#execution-ownership Runs the actual state owner with recorded ports and explicit typed envelopes in-process. It launches no host, build or installed consumer.
 */
export async function test_ttscgraph_shared_check_failure_and_close_settle_every_caller(): Promise<void> {
  const { session, ports } = sessionState();
  try {
    const first = session.graph();
    const second = session.graph();
    void first.catch(() => undefined);
    void second.catch(() => undefined);
    const port = await admitted(ports);
    session.receive(port.peer, {
      id: Number(port.writes[0]!.id),
      protocolVersion: 1,
      mode: "error",
      changed: false,
      capabilities: [],
      error: "authored load failure",
    });
    await assert.rejects(first, /authored load failure/);
    await assert.rejects(second, /authored load failure/);
    const recovered = session.graph();
    await admitted(ports, 2);
    session.receive(port.peer, emptyResponse(Number(port.writes[1]!.id)));
    assert.deepEqual((await recovered).nodes, []);
    assert.equal(ports.length, 1);
    const left = session.graph();
    const right = session.graph();
    void left.catch(() => undefined);
    void right.catch(() => undefined);
    await admitted(ports, 3);
    const closing = session.close();
    await assert.rejects(left, /native session closed/);
    await assert.rejects(right, /native session closed/);
    await closing;
    assertRetired(port);
    assert.equal(port.writes.length, 3);
  } finally {
    await session.close();
  }
}
