import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

interface Reducer {
  reduce(raw: {
    project: string;
    nodes: {
      id: string;
      name: string;
      kind: string;
      file: string;
    }[];
    edges: { from: string; to: string; kind: string }[];
  }): { nodes: { id: string; file: string }[] };
}

const loadReducer = async (
  relativePath: string,
  exported: "named" | "default",
): Promise<Reducer> => {
  const repository = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../..",
  );
  const module = (await import(
    pathToFileURL(path.join(repository, relativePath)).href
  )) as { reduce?: Reducer["reduce"]; default?: { reduce?: Reducer["reduce"] } };
  const reduce = exported === "named" ? module.reduce : module.default?.reduce;
  if (reduce === undefined) assert.fail(`${relativePath} exports reduce()`);
  return { reduce };
};

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
    const reducers = [
      await loadReducer("packages/graph/src/reduce.ts", "named"),
      await loadReducer(
        "website/src/components/graph/TtscWebsiteGraphReduce.ts",
        "default",
      ),
      await loadReducer("experimental/benchmark/graph/viewer.mjs", "named"),
    ];
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
