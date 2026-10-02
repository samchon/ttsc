import assert from "node:assert/strict";
import { DUMP_SCHEMA_VERSION } from "../../../../packages/graph/src/model/loadGraph";
import { admitted, assertRetired, emptyResponse, sessionState } from "./internal/sessionState";

/**
 * Verifies a response whose dump body declares schema 5 is rejected and its peer retired.
 *
 * The envelope is a well-formed serve-v1 response, but the dump inside it is from
 * an older schema. The session must refuse it, name both versions, and retire the
 * peer rather than trusting facts the old schema may lack.
 *
 * 1. Start a graph request and build an empty response whose dump provenance
 *    schemaVersion is 5.
 * 2. Deliver it and require the rejection "ttscgraph sends dump schema v5, this
 *    client reads v<current>" and the port to be retired.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphSessionState.receive of an envelope whose dump.provenance.schemaVersion is 5 must reject graph() with "ttscgraph sends dump schema v5, this client reads v" followed by DUMP_SCHEMA_VERSION, and retire the port as close(false) then close(true) with live false.
 * @evidence contracts/testing.md#independent-expectations The schema number 5 and the message text are literals; the consumer version in the expected message is read from the product's DUMP_SCHEMA_VERSION constant, so the test does not pin which current version is expected. No accepted-current-version control is delivered in this test.
 * @evidence contracts/testing.md#distinguishing-cases Only the body schema version differs from a valid empty response (the envelope, mode and ids are valid), so the rejection comes from the body-version policy rather than envelope shape. Snapshot-bodied responses and newer schemas are not covered.
 * @evidence contracts/testing.md#execution-ownership Runs TtscGraphSessionState directly in the test process against the recorded line ports of internal/sessionState, delivering a typed envelope to receive; TtscGraphProtocol.decode and a native process are not executed.
 */
export async function test_ttscgraph_rejects_schema_v5_snapshot(): Promise<void> {
  const fixture = sessionState();
  const { session, ports } = fixture;
  try {
    const active = session.graph();
    void active.catch(() => undefined);
    const port = await admitted(ports);
    const frame = emptyResponse(Number(port.writes[0]!.id));
    frame.dump!.provenance.schemaVersion = 5;
    session.receive(port.peer, frame);
    await assert.rejects(active, new RegExp(`ttscgraph sends dump schema v5, this client reads v${String(DUMP_SCHEMA_VERSION)}`));
    assertRetired(port);
  } finally { await session.close(); }
}
