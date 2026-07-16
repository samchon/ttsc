import {
  TtscCompiler,
  assert,
  createProject,
  tsgo,
} from "../../internal/compiler";

/**
 * Verifies a failed transform still carries the host-owned reference graph.
 *
 * `IFailure.graph` matters exactly when a module fails: a bundler that
 * registered no watch inputs for a broken module would never re-run its loader
 * when the type file causing the failure is fixed, freezing the error. The
 * native host therefore stamps the graph whenever the program loaded,
 * diagnostics or not, and the API must forward it on the failure shape.
 *
 * 1. Create a plugin-free project whose main.ts type-only-imports a type it then
 *    violates (a compile error).
 * 2. Call `transform()` via the programmatic API.
 * 3. Assert the failure result still carries the type-only edge.
 */
export const test_ttsccompiler_transform_failure_carries_reference_graph =
  () => {
    const root = createProject({
      files: {
        "src/mytype.ts": "export interface MyType { id: string }\n",
      },
      plugins: [],
      source:
        'import type { MyType } from "./mytype";\n' +
        "export const value: MyType = { id: 1 };\n",
    });
    const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

    const result = compiler.transform();

    assert.equal(result.type, "failure");
    assert.ok(result.graph, "failure result must carry the reference graph");
    assert.deepEqual(result.graph.edges["src/main.ts"], ["src/mytype.ts"]);
  };
