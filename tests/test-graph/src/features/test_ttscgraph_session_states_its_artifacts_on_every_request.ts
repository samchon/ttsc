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
 * 2. Complete initial and unchanged requests on the same port, requiring each
 *    of their two writes to carry artifacts equal to "".
 * 3. Publish "artifact path.json", then withdraw it with "", completing each
 *    request with an unchanged reply and checking its written artifacts field.
 * 4. Require all four requests to use the same port.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphNativeArguments.serve("/fixture", "tsconfig.json", null) must not include "--artifacts"; four graph() requests must stay on one port and forward host artifacts "", "", "artifact path.json", "" in order, after an initial response and then unchanged responses.
 * @evidence contracts/testing.md#independent-expectations The expected artifact answers, the absence of the flag and the port count of one are authored literals; the first two writes are counted before the host answer changes. The host stub supplies every answer, so the test verifies forwarding rather than real artifact discovery.
 * @evidence contracts/testing.md#distinguishing-cases Initial and unchanged requests are both checked, so a client that stated its artifacts only on the first request would fail. Subsequent unchanged requests forward a non-empty path containing a space and then an empty withdrawal on the same peer. An undefined answer is not covered.
 * @evidence contracts/testing.md#execution-ownership Runs TtscGraphNativeArguments.serve and TtscGraphSessionState in the test process against the recorded line ports of internal/sessionState with typed responses passed to receive; no plugin discovery, native process or decoder is involved.
 */
export async function test_ttscgraph_session_states_its_artifacts_on_every_request(): Promise<void> {
  const { session, ports, setArtifacts } = sessionState();
  try {
    const args = TtscGraphNativeArguments.serve("/fixture", "tsconfig.json", null);
    assert.equal(args.includes("--artifacts"), false);
    const active = session.graph();
    void active.catch(() => undefined);
    const port = await admitted(ports);
    session.receive(port.peer, emptyResponse(Number(port.writes[0]!.id)));
    await active;
    const next = session.graph();
    void next.catch(() => undefined);
    await admitted(ports, 2);
    session.receive(port.peer, emptyResponse(Number(port.writes[1]!.id), false));
    await next;
    assert.equal(ports.length, 1);
    assert.equal(port.writes.length, 2);
    for (const request of port.writes) assert.equal(request.artifacts, "");
    for (const artifact of ["artifact path.json", ""]) {
      setArtifacts(artifact);
      const refresh = session.graph();
      void refresh.catch(() => undefined);
      await admitted(ports, port.writes.length + 1);
      const request = port.writes.at(-1)!;
      assert.equal(request.artifacts, artifact);
      session.receive(port.peer, emptyResponse(Number(request.id), false));
      await refresh;
    }
    assert.equal(ports.length, 1);
  } finally { await session.close(); }
}
