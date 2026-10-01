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
 *
 * @evidence contracts/testing.md#behavioral-verification Transforms a project with a type-only MyType import and an invalid id initializer, requiring failure and the exact main.ts to mytype.ts graph edge.
 * @evidence contracts/testing.md#independent-expectations The authored import determines the edge independently, and number id violates the interface string field; failure must not discard graph observations.
 * @evidence contracts/testing.md#distinguishing-cases This negative semantic result retains a type-only edge, complementing successful independent-root leaves and decoder malformed-graph filtering.
 * @evidence contracts/testing.md#execution-ownership TestExecutor executes the matching exported feature via actual native transform transport.
 * @evidence contracts/e2e.md#necessary-boundary The native compiler must publish its reference graph on the failure path and the JavaScript API must preserve it; isolated decoding does not establish producer failure-path output.
 * @evidence contracts/e2e.md#shared-execution One erroneous-project transform supplies both failure and graph assertions; no plugin is built, and the compiler executable/package preparation are shared.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A fresh registered two-file fixture fixes import identity and error state. No prior result is reused; the synchronous native child finishes before observation and suite cleanup owns the fixture.
 * @evidence contracts/e2e.md#preserved-coverage Failure, graph presence and exact type-only adjacency remain. Diagnostic code/location and complete graph equality are outside this entry.
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
