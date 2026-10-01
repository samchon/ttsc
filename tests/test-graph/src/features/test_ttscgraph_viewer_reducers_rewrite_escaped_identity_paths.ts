import assert from "node:assert/strict";

import { loadViewerReducers } from "../internal/viewerReducers";

/**
 * Verifies viewer identity: every reducer rewrites the escaped path component,
 * not the first literal hash it encounters.
 *
 * A raw path can contain '#', while the wire id quotes it as `\\#`. All three
 * viewer runtimes must decode the path before relativizing it and re-encode the
 * result, otherwise the node id and its edge endpoints stop matching.
 *
 * 1. Load the package, website, and benchmark reducer copies.
 * 2. Reduce one hash-bearing absolute source id and self edge.
 * 3. Assert each produces the same relative id and file.
 *
 * @evidence contracts/testing.md#behavioral-verification All three authored reducer copies return the literal relative file and id for a hash-bearing absolute path.
 * @evidence contracts/testing.md#independent-expectations The wire grammar escapes a hash inside a file path; rerooting must decode that path and preserve the symbol boundary.
 * @evidence contracts/testing.md#distinguishing-cases A hash-bearing absolute path and self-edge distinguish the path escape from the separator without relying on another reducer as oracle.
 * @evidence contracts/testing.md#execution-ownership The named exported src/features entry calls authored operations through the unit loader; fixtures are in-memory and no installed artifact, native build or product process is needed.
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
