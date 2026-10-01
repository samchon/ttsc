import { findEdge } from "../../../internal/graph/internal/graphDump";
import { getIdentityDump, withIdentityBoundary } from "../../../internal/graph/internal/identityBoundary";
import { assert } from "../../../internal/graph/internal/ttsgraph";

interface ToolResult {
  structuredContent?: unknown;
}

interface TraceResult {
  type: "trace";
  hops: { from: string; to: string; kind: string }[];
  reached: { id: string; name: string }[];
}

const traceOf = (result: ToolResult): TraceResult => {
  const value = (result.structuredContent ?? {}) as { result?: TraceResult };
  if (value.result?.type !== "trace")
    throw new Error("Unexpected graph result: " + JSON.stringify(value));
  return value.result;
};

/**
 * Verifies a checker-rejected implementation cannot become a runtime dispatch.
 *
 * The old graph reader joined equal member names after loading the native dump,
 * so TS2416 and an implements edge could describe the same pair. Execution
 * tracing then promoted that false structural edge to dispatches and reached
 * code the interface call could never invoke.
 *
 * 1. Build one valid and one signature-incompatible CheckedPipeline implementation.
 * 2. Require the shipped binary dump to retain TS2416 and only the valid member
 *    edge.
 * 3. Trace an interface call and require dispatch into Good/accepted while Bad and
 *    rejected remain unreachable.
 *
 * @evidence contracts/testing.md#behavioral-verification The real native dump reports TS2416 yet retains all members, publishes Good's valid implements relation and excludes Bad's incompatible one; MCP dispatch reaches only accepted.
 * @evidence contracts/testing.md#independent-expectations The authored return types independently make Good compatible and Bad incompatible; literal diagnostics, edge presence/absence and accepted/rejected names establish both facts and consequence.
 * @evidence contracts/testing.md#distinguishing-cases Valid and incompatible methods share one contract, so name equality cannot pass the negative control; the graph remains usable despite the compiler diagnostic.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_graph, the exported scene case_ttscgraph_member_relations_follow_checker_dispatch starts the installed MCP launcher and reaches the native resident graph through stdio; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Actual checker assignability, dump diagnostics and subsequent MCP traversal must agree; a synthetic implements edge cannot test whether the producer rejected Bad.
 * @evidence contracts/e2e.md#shared-execution Thirty-two identity entries share one project: twenty-eight borrow one initialized MCP/native session; four producer assertion entries and the installed decoder case borrow one cached public CLI dump (checker uses both). Raw-only selections prepare no MCP. MCP ranking, exact tag queries and tour/hub contrasts select closed source universes; edits and config restoration advance actual generations without fresh clients.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint files, contracts, citations, aliases, external declarations and a physical workspace link preserve distinctions. MCP/tag scopes and invalid-config recovery restore config bytes finally; tour/hub variants overwrite only their own source and scope include to that file, retaining exact population/order/topology before each native request. Cached CLI facts serve unchanged assertions, and suite finally joins its client after complete collection.
 * @evidence contracts/e2e.md#preserved-coverage TS2416, retained members, valid-edge positive, invalid-edge negative, Good dispatch/accepted and Bad/rejected exclusions all remain executable.
 */
export const case_ttscgraph_member_relations_follow_checker_dispatch =
  async () => {
    await withIdentityBoundary(async (client, root) => {
    const dump = await getIdentityDump();
    assert.ok(
      dump.diagnostics.some((diagnostic) => diagnostic.code === 2416),
      "the same dump retains TS2416: " + JSON.stringify(dump.diagnostics),
    );
    const implementations = dump.nodes.filter(
      (node) =>
        node.file === "src/checked-dispatch.ts" &&
        node.name === "execute" &&
        node.kind === "method",
    );
    const goodExecute = implementations.find(
      (node) => node.qualifiedName === "Good.execute",
    );
    const badExecute = implementations.find(
      (node) => node.qualifiedName === "Bad.execute",
    );
    const contractExecute = implementations.find(
      (node) => node.qualifiedName === "CheckedPipeline.execute",
    );
    assert.ok(
      goodExecute !== undefined &&
        badExecute !== undefined &&
        contractExecute !== undefined,
      "all member nodes are dumped: " + JSON.stringify(implementations),
    );
    assert.ok(
      findEdge(dump, goodExecute, contractExecute, "implements") !== undefined,
      "the checker-valid member pair is serialized",
    );
    assert.ok(
      findEdge(dump, badExecute, contractExecute, "implements") === undefined,
      "the checker-rejected member pair is absent",
    );

      const result = (await client.request("tools/call", {
        name: "inspect_typescript_graph",
        arguments: {
          question: "What does CheckedRunner.run actually execute?",
          draft: {
            reason: "Follow the interface call into checker-valid bodies.",
            type: "trace",
          },
          review: "Keep the execution trace and its dispatch evidence.",
          request: {
            type: "trace",
            from: "CheckedRunner.run",
            direction: "forward",
            focus: "execution",
            maxDepth: 5,
            maxNodes: 12,
          },
        },
      })) as ToolResult;

      const trace = traceOf(result);
      const reached = trace.reached.map((node) => node.name);
      const dispatchTargets = trace.hops
        .filter((hop) => hop.kind === "dispatches")
        .map((hop) => trace.reached.find((node) => node.id === hop.to)?.name);
      assert.ok(
        dispatchTargets.includes("Good.execute"),
        "the valid implementation is dispatched: " + dispatchTargets.join(", "),
      );
      assert.ok(
        reached.includes("accepted"),
        "valid implementation work is reached: " + reached.join(", "),
      );
      assert.ok(
        !dispatchTargets.includes("Bad.execute") &&
          !reached.includes("Bad.execute") &&
          !reached.includes("rejected"),
        "rejected implementation stays unreachable: " + reached.join(", "),
      );
    });
  };
