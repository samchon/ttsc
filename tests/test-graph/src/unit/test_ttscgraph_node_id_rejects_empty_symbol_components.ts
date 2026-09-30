import assert from "node:assert/strict";
import { parseTtscGraphNodeId } from "../../../../packages/graph/src/model/TtscGraphNodeId";

/**
 * Verifies node identity parsing: an id with an empty symbol component is not a
 * readable graph identity.
 *
 * The Go producer rejects `path#:kind`; accepting it in the TypeScript reader
 * would make malformed stale handles silently enter the symbol lookup path.
 * Both codec endpoints must fail closed for the same invalid component shape.
 *
 * 1. Load the authored graph node-id reader.
 * 2. Decode an id whose name component is empty.
 * 3. Assert the reader rejects it.
 *
 * @evidence contracts/testing.md#behavioral-verification parseTtscGraphNodeId rejects an id with an empty symbol component.
 * @evidence contracts/testing.md#independent-expectations The graph identity grammar requires a nonempty symbol between the hash separator and kind.
 * @evidence contracts/testing.md#distinguishing-cases This malformed empty component pins rejection; escaped private-member and valid identity forms are covered by resolver units.
 * @evidence contracts/testing.md#execution-ownership The named exported src/unit entry calls authored operations through the unit loader; fixtures are in-memory and no installed artifact, native build or product process is needed.
 */
export function test_ttscgraph_node_id_rejects_empty_symbol_components(): void {
    assert.strictEqual(
      parseTtscGraphNodeId("src/example.ts#:variable"),
      undefined,
    );
}
