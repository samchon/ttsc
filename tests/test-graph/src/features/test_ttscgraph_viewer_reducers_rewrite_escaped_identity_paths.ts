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
 */
export const test_ttscgraph_viewer_reducers_rewrite_escaped_identity_paths =
  async (): Promise<void> => {
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
  };
