import assert from "node:assert/strict";
import { TtscGraphNativeArguments } from "../../../../packages/graph/src/model/TtscGraphNativeArguments";
import { admitted, emptyResponse, sessionState } from "./internal/sessionState";

/**
 * Verifies the session writes the host's artifact answer into every request, and the serve argv omits a null overlay.
 *
 * An absent artifacts field would mean the client has no opinion, while an empty
 * string withdraws any overlay. With a host answering the empty string, both the
 * initial and the following unchanged request must carry artifacts: "". The
 * serve argv builder must add no --artifacts flag for a null artifact path.
 *
 * 1. Build the serve argv with a null artifact path and require no --artifacts.
 * 2. Complete an initial request, then issue and complete an unchanged request on
 *    the same port.
 * 3. Require one port, two recorded writes, and artifacts equal to "" in each.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphNativeArguments.serve("/fixture", "tsconfig.json", null) must not include "--artifacts"; two successive graph() requests on TtscGraphSessionState must be written on one port (initial then unchanged response) and each written request must carry artifacts "".
 * @evidence contracts/testing.md#independent-expectations The expected empty string, the absence of the flag, the write count of two and the port count of one are literals; the host stub in internal/sessionState supplies the empty answer, so the test shows the state forwards the host's answer and does not exercise real artifact discovery.
 * @evidence contracts/testing.md#distinguishing-cases Initial and unchanged requests are both checked, so a client that stated its artifacts only on the first request would fail. Only the empty answer is exercised: a non-empty path, an undefined answer and a change of answer between requests are not covered.
 * @evidence contracts/testing.md#execution-ownership Runs TtscGraphNativeArguments.serve and TtscGraphSessionState in the test process against the recorded line ports of internal/sessionState with typed responses passed to receive; no plugin discovery, native process or decoder is involved.
 */
export async function test_ttscgraph_session_states_its_artifacts_on_every_request(): Promise<void> {
  const { session, ports } = sessionState();
  try {
    const args = TtscGraphNativeArguments.serve("/fixture", "tsconfig.json", null);
    assert.equal(args.includes("--artifacts"), false);
    const active = session.graph();
    const port = await admitted(ports);
    session.receive(port.peer, emptyResponse(Number(port.writes[0]!.id)));
    await active;
    const next = session.graph();
    await admitted(ports, 2);
    session.receive(port.peer, emptyResponse(Number(port.writes[1]!.id), false));
    await next;
    assert.equal(ports.length, 1);
    assert.equal(port.writes.length, 2);
    for (const request of port.writes) assert.equal(request.artifacts, "");
  } finally { session.close(); }
}
