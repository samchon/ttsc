import assert from "node:assert/strict";

import { admitted, assertRetired, emptyResponse, sessionState } from "./internal/sessionState";

/**
 * Verifies a shared freshness check outlives one cancelled consumer, and ends
 * when every consumer cancels.
 *
 * 1. Cancel one of two admitted consumers and require its sibling to receive
 *    the original request's reply without retiring the peer.
 * 2. Cancel both consumers of a later check and require native retirement.
 * 3. Recover on a new peer, cancel an entire queued group and require it to
 *    perform no native check or peer retirement after the active head succeeds.
 *
 * @evidence contracts/testing.md#behavioral-verification One active abort rejects only its caller while its sibling gets the graph; the last abort retires the peer and later graph demand opens a new one.
 * @evidence contracts/testing.md#independent-expectations Authored transport counts of one initial write, no retirement after one abort, and one retirement after both aborts distinguish caller ownership from native producer ownership.
 * @evidence contracts/testing.md#distinguishing-cases Partial and total active cancellation, recovery, an entirely cancelled queued group and an already-aborted admission distinguish producer ownership from live demand. Empty queued groups perform no write and cannot retire the successful head's peer.
 * @evidence contracts/testing.md#execution-ownership Direct session-state calls use recorded line ports and explicit valid envelopes in the unit process, without real native host or compilation.
 */
export async function test_ttscgraph_shared_check_keeps_individual_cancellation(): Promise<void> {
  const { session, ports } = sessionState();
  try {
    const one = new AbortController();
    const first = session.graph({ signal: one.signal });
    void first.catch(() => undefined);
    const second = session.graph();
    const port = await admitted(ports);
    one.abort();
    await assert.rejects(first, /cancelled/);
    assert.equal(port.live, true);
    assert.deepEqual(port.retirement, []);
    session.receive(port.peer, emptyResponse(Number(port.writes[0]!.id)));
    assert.deepEqual((await second).nodes, []);
    const left = new AbortController();
    const right = new AbortController();
    const a = session.graph({ signal: left.signal });
    const b = session.graph({ signal: right.signal });
    void a.catch(() => undefined);
    void b.catch(() => undefined);
    await admitted(ports, 2);
    left.abort();
    assert.equal(port.live, true);
    right.abort();
    await assert.rejects(a, /cancelled/);
    await assert.rejects(b, /cancelled/);
    assertRetired(port);
    const recovered = session.graph();
    const next = await admitted(ports);
    assert.notEqual(next, port);
    session.receive(next.peer, emptyResponse(Number(next.writes[0]!.id)));
    assert.deepEqual((await recovered).nodes, []);
    const head = session.graph();
    await admitted(ports, 2);
    const queuedLeft = new AbortController();
    const queuedRight = new AbortController();
    const queuedA = session.graph({ signal: queuedLeft.signal });
    const queuedB = session.graph({ signal: queuedRight.signal });
    void queuedA.catch(() => undefined);
    void queuedB.catch(() => undefined);
    queuedLeft.abort();
    queuedRight.abort();
    await assert.rejects(queuedA, /cancelled/);
    await assert.rejects(queuedB, /cancelled/);
    session.receive(next.peer, emptyResponse(Number(next.writes[1]!.id), false));
    await head;
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(next.writes.length, 2);
    assert.deepEqual(next.retirement, []);
    const alreadyAborted = new AbortController();
    alreadyAborted.abort();
    await assert.rejects(session.graph({ signal: alreadyAborted.signal }), /cancelled/);
    const fresh = session.graph();
    await admitted(ports, 3);
    session.receive(next.peer, emptyResponse(Number(next.writes[2]!.id), false));
    await fresh;
    assert.equal(next.writes.length, 3);
  } finally {
    await session.close();
  }
}
