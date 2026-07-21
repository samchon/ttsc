import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const graphEntry = require.resolve("@ttsc/graph");
const graphLib = path.dirname(graphEntry);
const { parseTtscGraphNodeId } = require(
  path.join(graphLib, "model", "TtscGraphNodeId.js"),
) as {
  parseTtscGraphNodeId(id: string): unknown;
};

/**
 * Verifies node identity parsing: an id with an empty symbol component is not a
 * readable graph identity.
 *
 * The Go producer rejects `path#:kind`; accepting it in the TypeScript reader
 * would make malformed stale handles silently enter the symbol lookup path.
 * Both codec endpoints must fail closed for the same invalid component shape.
 *
 * 1. Load the built graph package's node-id reader.
 * 2. Decode an id whose name component is empty.
 * 3. Assert the reader rejects it.
 */
export const test_ttscgraph_node_id_rejects_empty_symbol_components =
  (): void => {
    assert.strictEqual(
      parseTtscGraphNodeId("src/example.ts#:variable"),
      undefined,
    );
  };
