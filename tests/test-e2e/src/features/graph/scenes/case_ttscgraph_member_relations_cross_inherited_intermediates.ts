import { withIdentityBoundary } from "../../../internal/graph/internal/identityBoundary";
import { assert } from "../../../internal/graph/internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

interface TraceResult {
  type: "trace";
  hops: { from: string; to: string; kind: string }[];
  reached: { id: string; name: string }[];
}

const graphArguments = (props: {
  thinking: string;
  request: Record<string, unknown>;
}) => ({
  question: props.thinking,
  draft: {
    reason: "The smallest useful sacred graph step.",
    type: props.request.type,
  },
  review:
    "Confirmed: keep this final request; do not replace graph facts with file reads.",
  request: props.request,
});

const traceOf = (result: ToolResult): TraceResult => {
  const value = (result.structuredContent ?? {}) as { result?: TraceResult };
  if (value.result?.type !== "trace")
    throw new Error(`Unexpected graph result: ${JSON.stringify(value)}`);
  return value.result;
};

/**
 * Verifies a member relation survives an intermediate type that inherits the
 * member instead of declaring it.
 *
 * The producer emitted `implements` and `overrides` only when the member was
 * written on the type the heritage clause names. When that type inherits it
 * instead, the checker still resolves a valid derived/base pair and the program
 * compiles clean, but no edge was emitted — and `dispatchEdges` synthesizes its
 * `dispatches` hop by following exactly those incoming edges, so an execution
 * trace stopped at the abstract declaration with the implementation reachable
 * from nothing.
 *
 * 1. Declare the work on a root abstract class, inherit it through an empty
 *    intermediate, and implement it on the concrete class.
 * 2. Trace forward from the caller with execution focus.
 * 3. Assert the trace dispatches into the concrete implementation and reaches the
 *    work behind it.
 *
 * @evidence contracts/testing.md#behavioral-verification MCP trace crosses RootWorker.process through an inherited abstract intermediate to ConcreteWorker.process and reaches persistInherited, retaining the real implementation seam.
 * @evidence contracts/testing.md#independent-expectations The authored inheritance chain has only one concrete implementation and one persistInherited call; literal dispatch and reached-name assertions do not infer implementation from degree.
 * @evidence contracts/testing.md#distinguishing-cases An intermediate that declares no override must not break the Root-to-Concrete relation. This positive inherited path does not own invalid-signature rejection; the checker-dispatch case does.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_graph, the exported scene case_ttscgraph_member_relations_cross_inherited_intermediates borrows the experiment's shared installed MCP/native session and drives its actual stdio connection; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Native checker heritage resolution must publish transitive member relations across the empty intermediate before resident traversal can dispatch.
 * @evidence contracts/e2e.md#shared-execution Identity consumers share one project and resident MCP/native session. Immutable producer assertions and installed decoders borrow one cached CLI dump; checker dispatch uses both. Raw dump preparation alone starts no MCP. Cold escape and a controlled unlinked transition reuse the identity project, with one additional dump for changed membership. Ranking, tag and tour/hub inputs retain closed source universes; edits and config restoration advance actual generations without fresh clients.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint files, contracts, citations, aliases, external declarations and a physical workspace link preserve distinctions. MCP/tag scopes and invalid-config recovery restore config bytes after settled requests; a timed-out or lost transport forbids further edits and resets, withdraws reuse and retains both project and external receipt inputs until the experiment attempts actual child joins. Tour/hub variants overwrite only their own source and scope include to that file, retaining exact population/order/topology. Cached CLI facts serve unchanged assertions.
 * @evidence contracts/e2e.md#preserved-coverage Original Concrete dispatch and persistInherited reachability assertions remain. This case alone does not establish negative dispatch filtering or every intermediate node.
 */
export const case_ttscgraph_member_relations_cross_inherited_intermediates =
  async () => {
    await withIdentityBoundary(async (client) => {
      const result = (await client.request("tools/call", {
        name: "inspect_typescript_graph",
        arguments: graphArguments({
          thinking: "What does a run actually execute?",
          request: {
            type: "trace",
            from: "InheritedRunner.run",
            direction: "forward",
            focus: "execution",
            maxDepth: 6,
            maxNodes: 16,
          },
        }),
      })) as ToolResult;

      const trace = traceOf(result);
      const dispatched = trace.hops
        .filter((hop) => hop.kind === "dispatches")
        .map((hop) => trace.reached.find((node) => node.id === hop.to)?.name);
      assert.ok(
        dispatched.includes("ConcreteWorker.process"),
        `the inherited abstract member must still dispatch: ${dispatched.join(", ")}`,
      );
      const reached = trace.reached.map((node) => node.name);
      assert.ok(
        reached.includes("persistInherited"),
        `the work behind the implementation is reached: ${reached.join(", ")}`,
      );
    });
  };
