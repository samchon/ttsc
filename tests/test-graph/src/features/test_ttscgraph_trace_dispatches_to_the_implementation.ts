import { withIdentityBoundary } from "../internal/identityBoundary";
import { assert } from "../internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

interface TraceResult {
  type: "trace";
  hops: { from: string; to: string; kind: string }[];
  reached: { id: string; name: string }[];
  steps?: string[];
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
 * Verifies a forward trace continues into the implementation a virtual call
 * dispatches to, instead of stopping at the declaration the checker resolved.
 *
 * A call that lands on an abstract method or an interface member reaches a
 * declaration with no body, and the code that runs hangs off it as an incoming
 * `overrides`/`implements` edge — an edge no forward walk crosses. NestJS's
 * whole request pipeline sits behind one of these, so the graph reported that a
 * request reaches an abstract declaration and stops, and the guard it actually
 * runs was reachable from nothing but its own unit test. This pins the
 * continuation: the dead-end declaration yields a `dispatches` hop to every
 * implementation that has a body, cited at the implementation.
 *
 * 1. Materialize a project where `AbstractRunner.run` calls the abstract
 *    `AbstractPipeline.execute`, which two concrete pipelines implement.
 * 2. Trace forward from `AbstractRunner.run` with execution focus.
 * 3. Assert both implementations are reached over `dispatches` hops, and that the
 *    work each one does (`transform`, `persistAbstract`) is reached behind them.
 *
 * @evidence contracts/testing.md#behavioral-verification MCP trace follows AbstractRunner through AbstractPipeline.start to both concrete abstract-member implementations and reaches transform and persistAbstract.
 * @evidence contracts/testing.md#independent-expectations The authored call chain and two concrete class bodies independently name the required implementation and terminal handles.
 * @evidence contracts/testing.md#distinguishing-cases Two valid implementations exercise branching dispatch after a real call; this positive case does not own invalid-signature rejection, which member_relations_follow_checker_dispatch covers.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_trace_dispatches_to_the_implementation starts the installed MCP launcher and reaches the native resident graph through stdio; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Native checker member relations must connect the abstract call seam to its concrete implementations before MCP traversal can show runtime continuation.
 * @evidence contracts/e2e.md#shared-execution Twelve identity/display, documentation/citation and member-dispatch entries borrow one composite project, initialized MCP session and resident native compiler. Only the object-source mutation requires a new generation. The checker-rejection entry also executes the public dump CLI once against this project because its diagnostics/raw edges are a separate entrypoint connection; all named assertions remain.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique source files, symbol names and citation targets isolate each fixture; disjoint checked, abstract and inherited dispatch contracts prevent cross-case implementations. Only object-outline.ts changes. Serial requests synchronize its delta and suite finally closes the shared client with a successful-exit assertion after complete result collection.
 * @evidence contracts/e2e.md#preserved-coverage Both implementation dispatches and transform/persistAbstract reachability assertions remain here; direct traversal units do not alone replace actual checker relation publication.
 */
export const test_ttscgraph_trace_dispatches_to_the_implementation =
  async () => {
    await withIdentityBoundary(async (client) => {
      const result = (await client.request("tools/call", {
        name: "inspect_typescript_graph",
        arguments: graphArguments({
          thinking: "What does a run actually execute?",
          request: {
            type: "trace",
            from: "AbstractRunner.run",
            direction: "forward",
            focus: "execution",
            maxDepth: 6,
            maxNodes: 16,
          },
        }),
      })) as ToolResult;

      const trace = traceOf(result);
      const reached = trace.reached.map((node) => node.name);
      const dispatched = trace.hops
        .filter((hop) => hop.kind === "dispatches")
        .map((hop) => trace.reached.find((node) => node.id === hop.to)?.name);

      assert.ok(
        reached.includes("AbstractPipeline.start"),
        `the trace reaches the base method: ${reached.join(", ")}`,
      );
      assert.ok(
        dispatched.includes("TransformAbstractPipeline.execute") &&
          dispatched.includes("PersistAbstractPipeline.execute"),
        `the abstract method dispatches to both implementations: ${dispatched.join(", ")}`,
      );
      assert.ok(
        reached.includes("transform") && reached.includes("persistAbstract"),
        `the work behind each implementation is reached: ${reached.join(", ")}`,
      );
    });
  };
