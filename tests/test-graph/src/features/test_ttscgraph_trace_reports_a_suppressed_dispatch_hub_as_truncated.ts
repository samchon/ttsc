import { TestProject } from "@ttsc/testing";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

interface TraceResult {
  type: "trace";
  hops: { from: string; to: string; kind: string }[];
  reached: { id: string; name: string }[];
  truncated: boolean;
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

const project = (implementations: number): string =>
  TestProject.createProject({
    "tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          rootDir: "src",
          outDir: "dist",
        },
        include: ["src"],
      },
      null,
      2,
    ),
    "src/app.ts": [
      "export abstract class Hub {",
      "  public abstract execute(): void;",
      "}",
      "",
      ...Array.from({ length: implementations }, (_, index) =>
        [
          `export class Impl${index} extends Hub {`,
          "  public execute(): void {}",
          "}",
          "",
        ].join("\n"),
      ),
      "export class Runner {",
      "  public constructor(private readonly hub: Hub) {}",
      "",
      "  public run(): void {",
      "    this.hub.execute();",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

const trace = async (root: string): Promise<TraceResult> => {
  const client = TtsgraphClient.start(root);
  try {
    await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test-graph", version: "0.0.0" },
    });
    client.notify("notifications/initialized", {});
    const result = (await client.request("tools/call", {
      name: "inspect_typescript_graph",
      arguments: graphArguments({
        thinking: "What does a run actually execute?",
        request: {
          type: "trace",
          from: "Runner.run",
          direction: "forward",
          focus: "execution",
          maxDepth: 6,
          maxNodes: 32,
        },
      }),
    })) as ToolResult;
    return traceOf(result);
  } finally {
    client.endStdin();
    await client.waitForExit();
  }
};

/**
 * Verifies an open trace reports a dispatch fanout the hub bound withheld.
 *
 * Above the hub cut the walk deliberately stops at the declaration: naming
 * every implementor of a codebase-wide interface is a dump, not a flow. That
 * decision is sound, but it used to be invisible — the selection returned an
 * empty list, which is exactly what a declaration with no dispatch fact
 * returns, so the result claimed to be complete while eligible hops had been
 * dropped. The trace contract says `truncated` is true whenever a bound omits
 * an eligible node or hop.
 *
 * 1. Trace into an abstract declaration with one implementation fewer than the hub
 *    cut, and assert the dispatch hops are followed.
 * 2. Trace into the same shape at the cut, and assert no dispatch hop survives.
 * 3. Assert only the suppressed run reports `truncated`.
 *
 * @evidence contracts/testing.md#behavioral-verification MCP trace follows all eleven implementations without truncation, but suppresses all dispatch hops at twelve and reports truncation.
 * @evidence contracts/testing.md#independent-expectations Literal authored populations eleven and twelve bracket the supported hub threshold; expected counts and booleans are not computed from the returned selection.
 * @evidence contracts/testing.md#distinguishing-cases One below the hub bound contrasts exactly the hub bound, distinguishing a genuine omitted fan-out from an empty declaration.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_trace_reports_a_suppressed_dispatch_hub_as_truncated starts the installed MCP launcher and reaches the native resident graph through stdio; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Real compiler heritage facts must arrive in the graph before native-to-MCP traversal can report that withheld implementations were present.
 * @evidence contracts/e2e.md#shared-execution Two isolated population fixtures share the suite producer artifact but use separate project/session lifetimes. A resettable threshold batch is possible and not yet implemented.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Separate projects isolate eleven and twelve implementations; each helper ends stdin and awaits exit in finally without asserting its code. The client's exit timeout can reject without killing its child.
 * @evidence contracts/e2e.md#preserved-coverage Exact eleven/zero dispatch counts and false/true truncation assertions remain; no threshold, fixture size or omission flag has been weakened.
 */
export const test_ttscgraph_trace_reports_a_suppressed_dispatch_hub_as_truncated =
  async () => {
    // The cut is 12. Eleven is the largest fanout the walk still follows.
    const followed = await trace(project(11));
    const followedDispatches = followed.hops.filter(
      (hop) => hop.kind === "dispatches",
    );
    assert.equal(
      followedDispatches.length,
      11,
      `below the hub cut every implementation is a hop: ${JSON.stringify(followed.hops)}`,
    );
    assert.equal(
      followed.truncated,
      false,
      "a fanout the walk follows completely is not truncated",
    );

    const suppressed = await trace(project(12));
    assert.equal(
      suppressed.hops.filter((hop) => hop.kind === "dispatches").length,
      0,
      "at the hub cut the walk stops at the declaration",
    );
    assert.equal(
      suppressed.truncated,
      true,
      "a suppressed dispatch fanout is an omission the result must report",
    );
  };
