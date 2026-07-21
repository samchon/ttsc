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
 */
export const test_ttscgraph_member_relations_cross_inherited_intermediates =
  async () => {
    const root = TestProject.createProject({
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
        "export function persist(): void {}",
        "",
        "export abstract class RootWorker {",
        "  public abstract process(): void;",
        "",
        "  public start(): void {",
        "    this.process();",
        "  }",
        "}",
        "",
        "export abstract class IntermediateWorker extends RootWorker {}",
        "",
        "export class ConcreteWorker extends IntermediateWorker {",
        "  public process(): void {",
        "    persist();",
        "  }",
        "}",
        "",
        "export class Runner {",
        "  public constructor(private readonly worker: RootWorker) {}",
        "",
        "  public run(): void {",
        "    this.worker.start();",
        "  }",
        "}",
        "",
      ].join("\n"),
    });

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
        reached.includes("persist"),
        `the work behind the implementation is reached: ${reached.join(", ")}`,
      );
    } finally {
      client.endStdin();
      await client.waitForExit();
    }
  };
