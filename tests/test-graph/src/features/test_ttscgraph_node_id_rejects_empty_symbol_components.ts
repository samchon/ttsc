import assert from "node:assert/strict";
import { parseTtscGraphNodeId } from "../../../../packages/graph/src/model/TtscGraphNodeId";

/**
 * Verifies the graph node-id reader rejects an id whose symbol name is empty.
 *
 * An id of the form path#:kind has no symbol name. The TypeScript reader must
 * return undefined for it so a malformed stale handle cannot enter symbol lookup.
 *
 * 1. Call parseTtscGraphNodeId with "src/example.ts#:variable".
 * 2. Require undefined.
 *
 * @evidence contracts/testing.md#behavioral-verification parseTtscGraphNodeId("src/example.ts#:variable") must return undefined.
 * @evidence contracts/testing.md#independent-expectations The id string and the expected undefined are literals; the rule that the symbol between the hash separator and the kind must be non-empty comes from the documented path#name:kind grammar, not from the reader's code.
 * @evidence contracts/testing.md#distinguishing-cases Only the empty-name case is covered. An empty kind, a missing hash, escaped separators and a valid id as a positive control are not exercised here, and only the reader is tested, not the writer.
 * @evidence contracts/testing.md#execution-ownership Calls the pure parseTtscGraphNodeId function in the test process with an in-memory string; no file, process or native artifact is involved.
 */
export function test_ttscgraph_node_id_rejects_empty_symbol_components(): void {
    assert.strictEqual(
      parseTtscGraphNodeId("src/example.ts#:variable"),
      undefined,
    );
}
