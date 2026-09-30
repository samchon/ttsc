import assert from "node:assert/strict";
import { TtscGraphNativeArguments } from "../../../../packages/graph/src/model/TtscGraphNativeArguments";
import { admitted, emptyResponse, sessionState } from "./internal/sessionState";

/**
 * Verifies every resident request states an explicit no-artifact answer.
 *
 * Omitting an artifact field means silence rather than withdrawal. The state
 * must emit the current host answer on initial and unchanged requests, while
 * the actual startup builder must omit the optional overlay flag.
 *
 * 1. Build the no-overlay native launch vector and admit two requests.
 * 2. Supply matching initial and unchanged typed inputs on one port.
 * 3. Require exactly two writes with empty artifacts and one opener.
 *
 * @evidence contracts/testing.md#behavioral-verification Authored serve argv omits --artifacts; actual state writes two requests carrying artifacts:"" and uses one transport owner.
 * @evidence contracts/testing.md#independent-expectations Literal missing startup flag, one opener, two writes and empty payload fields define withdrawal independently of returned graph values.
 * @evidence contracts/testing.md#distinguishing-cases Initial and unchanged requests both state none; actual installed no-publisher discovery and default native transport are covered by the surviving real resident boundary.
 * @evidence contracts/testing.md#execution-ownership This src/unit entry executes the owning argument builder and state source with declared write recordings, without a process or fake producer. Discovery is not claimed from the supplied host answer.
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
