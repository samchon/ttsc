import assert from "node:assert/strict";

import { TtscGraphApplication } from "../../../../packages/graph/src/TtscGraphApplication";

import { createSyntheticGraph } from "../internal/resolverGraph";

/**
 * Verifies the audit of an impact trace discloses the `test` role as the
 * server's own, not the compiler's.
 *
 * The `test` role is chosen from a file's conventional test location, so an
 * audit that called every returned fact compiler-resolved would claim more than
 * the server checked. The `exported` role is a producer fact and the path
 * convention must not tag a similarly named source file.
 *
 * 1. Build a function called by a spec file and by a source file whose name only
 *    contains the word test.
 * 2. Request an impact trace from the function.
 * 3. Assert the spec caller carries `test`, the other caller does not, and the
 *    audit text says the `test` role is assigned from a test location.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphApplication.inspect_typescript_graph runs the real impact trace over a synthetic graph and returns reached callers with their roles and the audit; the assertions distinguish a server that tags path-convention tests but does not disclose it from one that does.
 * @evidence contracts/testing.md#independent-expectations The roles follow from the authored file paths and the documented test-path convention (a `.spec.ts` suffix, not the substring "test"); the audit expectation is the disclosure the contract requires, written as a literal rather than read from the product constant.
 * @evidence contracts/testing.md#distinguishing-cases The spec caller is the positive, src/contest.ts the adjacent negative that only contains the word, and the exported production caller shows the `exported` role stays; deeper path conventions are owned by the same predicate's other callers.
 * @evidence contracts/testing.md#execution-ownership The src/features export runs in the source-unit Node process through TtscGraphApplication and TtscGraphMemory; no installed package, native producer or MCP host starts.
 */
export async function test_ttscgraph_audit_discloses_the_test_role_the_server_assigns(): Promise<void> {
  const graph = createSyntheticGraph(
    [
      { id: "src/core.ts#run:function", kind: "function", name: "run", file: "src/core.ts", external: false },
      { id: "src/core.spec.ts#check:function", kind: "function", name: "check", file: "src/core.spec.ts", external: false },
      { id: "src/contest.ts#play:function", kind: "function", name: "play", file: "src/contest.ts", external: false, exported: true },
    ],
    [
      { from: "src/core.spec.ts#check:function", to: "src/core.ts#run:function", kind: "calls" },
      { from: "src/contest.ts#play:function", to: "src/core.ts#run:function", kind: "calls" },
    ],
  );
  const output = await new TtscGraphApplication(graph).inspect_typescript_graph({
    question: "What does changing run affect?",
    draft: { reason: "Impact of one known function.", type: "trace" },
    review: "Keep the explicit request.",
    request: { type: "trace", from: "run", direction: "impact" },
  });
  assert.equal(output.result.type, "trace");
  if (output.result.type !== "trace") assert.fail("trace result required");
  const rolesOf = (name: string) =>
    output.result.type === "trace"
      ? output.result.reached.find((node) => node.name === name)?.roles
      : undefined;
  assert.deepEqual(rolesOf("check"), ["test"]);
  assert.deepEqual(rolesOf("play"), ["exported"]);
  assert.match(
    output.audit,
    /the `test` role and `tests` anchors,\nwhich it assigns from a file's conventional test location rather than from the compiler/,
  );
}
