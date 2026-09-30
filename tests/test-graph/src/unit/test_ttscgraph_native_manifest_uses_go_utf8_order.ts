import assert from "node:assert/strict";
import { admitted, sessionState } from "./internal/sessionState";
import { sessionTransaction } from "./internal/sessionTransactions";

/**
 * Verifies UTF-8 manifest order accepts the complete generation.
 *
 * Pinned literal U+E000 then U+10000 keys and content witnesses distinguish Go UTF-8 order from JavaScript UTF-16 ordering without calling the product digest helper.
 *
 * 1. Admit the original request state through the authored state owner.
 * 2. Supply explicit typed envelopes or transport events and check the original rejection, settlement or model assertions.
 * 3. Check retirement, recovery or reuse and close the owned state in finally.
 *
 * @evidence contracts/testing.md#behavioral-verification State and shard store accept literal U+E000-before-U+10000 manifest inputs with pinned valid witnesses and return empty nodes.
 * @evidence contracts/testing.md#independent-expectations The two literal keys reverse JavaScript UTF-16 order; their pinned content/generation hashes are independent typed protocol inputs, not results of the product hash or sort helper.
 * @evidence contracts/testing.md#distinguishing-cases Pinned literal U+E000 then U+10000 keys and content witnesses distinguish Go UTF-8 order from JavaScript UTF-16 ordering without calling the product digest helper.
 * @evidence contracts/testing.md#execution-ownership The matching src/unit export imports authored state and decoder source. Declared line-port recordings generate no reply; this executes in the source-unit Node process without a native executable. Actual kernel retirement and generated schema integration remain in the minimal E2E boundary.
 */
export async function test_ttscgraph_native_manifest_uses_go_utf8_order(): Promise<void> {
  const fixture = sessionState();
  const { session, ports } = fixture;
  try {
    const active = session.graph();
    const port = await admitted(ports);
    const snapshot = sessionTransaction("unicode");
    assert.deepEqual(snapshot.manifest.map((item) => item.key), ["0:metadata:\ue000", "0:metadata:\u{10000}"]);
    session.receive(port.peer, { id: Number(port.writes[0]!.id), protocolVersion: 1, mode: "initial", changed: true, capabilities: [], snapshot });
    assert.deepEqual((await active).nodes, []);
  } finally { session.close(); }
}
