import assert from "node:assert/strict";
import { admitted, assertRetired, emptyResponse, sessionState } from "./internal/sessionState";

/**
 * Verifies aborting an active request retires the peer even when the abort reason cannot be printed.
 *
 * Once the request has been written to the peer, an AbortSignal abort must reject
 * the request, retire the peer, and let the next request open a new one. A reason
 * whose toString throws must not stop that cleanup.
 *
 * 1. Start a graph request with an AbortSignal and wait until its request line is
 *    recorded as written to the port.
 * 2. Abort with an object whose toString throws, and require the cancellation
 *    error and the port to be retired (reader detached, then stdio joined).
 * 3. Request again, answer the second port with an empty full-dump response, and
 *    require an empty node list and exactly two opened ports.
 *
 * @evidence contracts/testing.md#behavioral-verification Aborting the signal of an admitted graph() request with a throwing-toString reason must reject it with "native snapshot request cancelled", record port close(false) then close(true), and a second graph() must open a second port and resolve to a model with no nodes.
 * @evidence contracts/testing.md#independent-expectations The recorded request write proves the request was active before the abort; the throwing reason object, the expected error pattern, the retirement sequence [false, true], the empty node list and the port count of two are authored literals.
 * @evidence contracts/testing.md#distinguishing-cases An abort after the write retires the peer (close(false) then close(true)), which a cancellation of a still-queued request would not do; the unprintable reason covers the diagnostic path that must degrade to a message without detail. Queued abort is covered by a separate test.
 * @evidence contracts/testing.md#execution-ownership Runs TtscGraphSessionState directly in the test process against the recorded line ports of internal/sessionState. No line is decoded and no native process or kernel termination is involved.
 */
export async function test_ttscgraph_native_request_abort_restarts_session(): Promise<void> {
  const fixture = sessionState();
  const { session, ports } = fixture;
  try {
    const controller = new AbortController();
    const active = session.graph({ signal: controller.signal });
    void active.catch(() => undefined);
    const port = await admitted(ports);
    controller.abort({ toString(): string { throw new Error("unprintable cancellation reason"); } });
    await assert.rejects(active, /native snapshot request cancelled/);
    assertRetired(port);

    const recovered = session.graph();
    void recovered.catch(() => undefined);
    const next = await admitted(ports);
    session.receive(next.peer, emptyResponse(Number(next.writes[0]!.id)));
    assert.deepEqual((await recovered).nodes, []);
    assert.equal(ports.length, 2);
  } finally { await session.close(); }
}
