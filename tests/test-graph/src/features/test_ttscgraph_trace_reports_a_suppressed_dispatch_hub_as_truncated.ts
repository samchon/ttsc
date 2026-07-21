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
