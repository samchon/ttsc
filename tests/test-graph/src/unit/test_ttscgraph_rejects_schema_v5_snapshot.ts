import assert from "node:assert/strict";
import { DUMP_SCHEMA_VERSION } from "../../../../packages/graph/src/model/loadGraph";
import { admitted, assertRetired, emptyResponse, sessionState } from "./internal/sessionState";

/**
 * Verifies body schema disagreement is independent of envelope shape.
 *
 * The typed serve-v1 envelope carries an older body schema; this checks version policy, while installed generated-decoder coverage owns full shape validation.
 *
 * 1. Admit the original request state through the authored state owner.
 * 2. Supply explicit typed envelopes or transport events and check the original rejection, settlement or model assertions.
 * 3. Check retirement, recovery or reuse and close the owned state in finally.
 *
 * @evidence contracts/testing.md#behavioral-verification State rejects a typed serve-v1 envelope whose dump body says schema five, naming both producer and current consumer versions and retiring the port.
 * @evidence contracts/testing.md#independent-expectations The literal old version is an independently incompatible policy input; only the consumer version is read from its protocol constant, and no accepted-current control is claimed in this case.
 * @evidence contracts/testing.md#distinguishing-cases The typed serve-v1 envelope carries an older body schema; this checks version policy, while installed generated-decoder coverage owns full shape validation.
 * @evidence contracts/testing.md#execution-ownership The matching src/unit export imports authored state and decoder source. Declared line-port recordings generate no reply; this executes in the source-unit Node process without a native executable. Actual kernel retirement and generated schema integration remain in the minimal E2E boundary.
 */
export async function test_ttscgraph_rejects_schema_v5_snapshot(): Promise<void> {
  const fixture = sessionState();
  const { session, ports } = fixture;
  try {
    const active = session.graph();
    const port = await admitted(ports);
    const frame = emptyResponse(Number(port.writes[0]!.id));
    frame.dump!.provenance.schemaVersion = 5;
    session.receive(port.peer, frame);
    await assert.rejects(active, new RegExp(`ttscgraph sends dump schema v5, this client reads v${String(DUMP_SCHEMA_VERSION)}`));
    assertRetired(port);
  } finally { session.close(); }
}
