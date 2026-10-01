import assert from "node:assert/strict";

import { loadViewerReducers } from "../internal/viewerReducers";

/**
 * Verifies every viewer reducer decodes an escaped hash in a path before relativizing it.
 *
 * A source path may contain '#', which the wire id quotes as #. Each viewer
 * reducer must treat that as part of the path rather than as the boundary before
 * the symbol, or the common-root rewrite will not recognise the file.
 *
 * 1. Load the package, website and fixture reducer copies.
 * 2. Reduce one dump holding a node whose absolute path contains a hash and a
 *    self edge.
 * 3. Require each copy to return the relative id "main.ts#main:function" and file
 *    "main.ts".
 *
 * @evidence contracts/testing.md#behavioral-verification Each of the three viewer reducer copies must reduce a node with file "/work/a#b/src/main.ts" and id "/work/a\#b/src/main.ts#main:function" (with a self edge) to exactly one node whose id is "main.ts#main:function" and whose file is "main.ts".
 * @evidence contracts/testing.md#independent-expectations The escaped input id and the expected relative id and file are literals written in the test from the wire grammar (a quoted hash belongs to the path); no reducer output is used as the oracle for another.
 * @evidence contracts/testing.md#distinguishing-cases Only a hash-bearing path with one self edge is reduced: a reducer that cut the id at the escaped hash would not recognise the common root and would keep a long path. The result contains no hash in its path, so re-escaping of a rewritten path is not exercised, and a path with an escaped backslash is not covered.
 * @evidence contracts/testing.md#execution-ownership Imports and runs the three reducer source files in the test process through loadViewerReducers with an in-memory dump; no browser, installed artifact, native build or product process is involved.
 */
export async function test_ttscgraph_viewer_reducers_rewrite_escaped_identity_paths(): Promise<void> {
    const reducers = await loadViewerReducers();
    const file = "/work/a#b/src/main.ts";
    const id = "/work/a\\#b/src/main.ts#main:function";
    const dump = {
      project: "fixture",
      nodes: [{ id, name: "main", kind: "function", file }],
      edges: [{ from: id, to: id, kind: "calls" }],
    };
    for (const reducer of reducers) {
      const result = reducer.reduce(dump);
      assert.strictEqual(result.nodes.length, 1);
      assert.deepEqual(
        { id: result.nodes[0]!.id, file: result.nodes[0]!.file },
        { id: "main.ts#main:function", file: "main.ts" },
      );
    }
}
