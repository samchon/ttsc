import assert from "node:assert/strict";

import type { ITtscGraphSnapshot } from "../../../../packages/graph/src/structures/ITtscGraphSnapshot";
import { admitted, assertRetired, emptyResponse, sessionState } from "./internal/sessionState";
import { sessionTransaction } from "./internal/sessionTransactions";

/**
 * Verifies each way a response can contradict its own mode retires the peer
 * with its own message, while a well-formed native error reply does not.
 *
 * A response says whether it is an error, whether it changed the graph and how
 * it carries the graph. The state refuses every combination that disagrees, and
 * a peer that sent one cannot be trusted again. A sidecar-reported error is a
 * valid answer to one request, so it fails that request only and the same peer
 * serves the next.
 *
 * 1. For each contradiction (an error carried by a non-error mode or by a
 *    changed response, an error mode with no error, a changed response in
 *    unchanged mode, with no body or with two bodies, and an unchanged response
 *    carrying a dump), deliver it on a fresh session and require its message
 *    and the port retired (reader detached, then stdio joined).
 * 2. For a well-formed error reply, require the "boom" rejection and the port
 *    still live with no retirement.
 * 3. Request again and require the second write on the same port.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphSessionState.receive of each of seven contradicting envelopes (two error-field combinations, an error mode without an error, a changed response in unchanged mode, with no body and with two bodies, and an unchanged response carrying a dump) must reject graph() with the literal "an error response carried snapshot state", "an error-mode response omitted its error", "a changed response did not carry exactly one snapshot body" or "an unchanged response carried changed mode or snapshot state" and retire the port as close(false) then close(true); a mode "error" envelope carrying an error and no body must reject graph() with "@ttsc/graph: boom" while the port stays live with no retirement and the next graph() writes its request on the same port.
 * @evidence contracts/testing.md#independent-expectations The envelopes are authored literal field combinations (mode, changed, error, dump, snapshot) from the serve response grammar, the expected messages are written in the test and the retirement sequence [false, true] and the live port are literals; the digests and generation of the one snapshot body are pinned literals in sessionTransactions.
 * @evidence contracts/testing.md#distinguishing-cases Seven authored combinations exercise the four semantic failure categories; the changed response in unchanged mode also has no body, so that row does not isolate the mode check. The genuine error reply rejects only its request and retains the peer; wrong body schema and unknown request id belong to siblings.
 * @evidence contracts/testing.md#execution-ownership This exported src/features entry runs the owning session state with recorded line ports in the test process, without a native child, installation or product serializer.
 */
export async function test_ttscgraph_native_responses_that_contradict_their_mode_each_retire_the_peer(): Promise<void> {
  const failures: unknown[] = [];
  const contradictions: [string, (id: number) => ITtscGraphSnapshot, RegExp][] = [
    [
      "error beside a non-error mode",
      (id) => ({ id, protocolVersion: 1, mode: "initial", capabilities: [], changed: false, error: "boom" }),
      /an error response carried snapshot state/,
    ],
    [
      "error beside a changed flag",
      (id) => ({ id, protocolVersion: 1, mode: "error", capabilities: [], changed: true, error: "boom" }),
      /an error response carried snapshot state/,
    ],
    [
      "error mode without an error",
      (id) => ({ id, protocolVersion: 1, mode: "error", capabilities: [], changed: false }),
      /an error-mode response omitted its error/,
    ],
    [
      "changed response in unchanged mode",
      (id) => ({ id, protocolVersion: 1, mode: "unchanged", capabilities: [], changed: true }),
      /a changed response did not carry exactly one snapshot body/,
    ],
    [
      "changed response with no body",
      (id) => ({ id, protocolVersion: 1, mode: "initial", capabilities: [], changed: true }),
      /a changed response did not carry exactly one snapshot body/,
    ],
    [
      "changed response with two bodies",
      (id) => ({ ...emptyResponse(id), snapshot: sessionTransaction() }),
      /a changed response did not carry exactly one snapshot body/,
    ],
    [
      "unchanged response carrying a dump",
      (id) => ({ ...emptyResponse(id), mode: "unchanged", changed: false }),
      /an unchanged response carried changed mode or snapshot state/,
    ],
  ];
  for (const [label, frame, message] of contradictions) {
    const { session, ports } = sessionState();
    try {
      const active = session.graph();
      void active.catch(() => undefined);
      const port = await admitted(ports);
      session.receive(port.peer, frame(Number(port.writes[0]!.id)));
      await assert.rejects(active, message, label);
      assertRetired(port);
    } catch (error) {
      failures.push(new Error(label, { cause: error }));
    } finally {
      await session.close();
    }
  }

  {
    const { session, ports } = sessionState();
    try {
      const active = session.graph();
      void active.catch(() => undefined);
      const port = await admitted(ports);
      session.receive(port.peer, { id: Number(port.writes[0]!.id), protocolVersion: 1, mode: "error", capabilities: [], changed: false, error: "boom" });
      await assert.rejects(active, /@ttsc\/graph: boom/);
      assert.equal(port.live, true);
      assert.deepEqual(port.retirement, []);
      const next = session.graph();
      void next.catch(() => undefined);
      await admitted(ports, 2);
      assert.equal(ports.length, 1);
      session.receive(port.peer, emptyResponse(Number(port.writes[1]!.id)));
      assert.deepEqual((await next).nodes, []);
    } catch (error) {
      failures.push(new Error("native error reply", { cause: error }));
    } finally {
      await session.close();
    }
  }
  if (failures.length) throw new AggregateError(failures, "response semantics");
}
