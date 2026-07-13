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
 * 1. Materialize a project where `Runner.run` calls the abstract
 *    `Pipeline.execute`, which two concrete pipelines implement.
 * 2. Trace forward from `Runner.run` with execution focus.
 * 3. Assert both implementations are reached over `dispatches` hops, and that the
 *    work each one does (`transform`, `persist`) is reached behind them.
 */
export const test_ttscgraph_trace_dispatches_to_the_implementation =
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
        "export function transform(): void {}",
        "export function persist(): void {}",
        "",
        "export abstract class Pipeline {",
        "  public abstract execute(): void;",
        "",
        "  public start(): void {",
        "    this.execute();",
        "  }",
        "}",
        "",
        "export class TransformPipeline extends Pipeline {",
        "  public execute(): void {",
        "    transform();",
        "  }",
        "}",
        "",
        "export class PersistPipeline extends Pipeline {",
        "  public execute(): void {",
        "    persist();",
        "  }",
        "}",
        "",
        "export class Runner {",
        "  public constructor(private readonly pipeline: Pipeline) {}",
        "",
        "  public run(): void {",
        "    this.pipeline.start();",
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
      const reached = trace.reached.map((node) => node.name);
      const dispatched = trace.hops
        .filter((hop) => hop.kind === "dispatches")
        .map((hop) => trace.reached.find((node) => node.id === hop.to)?.name);

      assert.ok(
        reached.includes("Pipeline.start"),
        `the trace reaches the base method: ${reached.join(", ")}`,
      );
      assert.ok(
        dispatched.includes("TransformPipeline.execute") &&
          dispatched.includes("PersistPipeline.execute"),
        `the abstract method dispatches to both implementations: ${dispatched.join(", ")}`,
      );
      assert.ok(
        reached.includes("transform") && reached.includes("persist"),
        `the work behind each implementation is reached: ${reached.join(", ")}`,
      );
    } finally {
      client.endStdin();
      await client.waitForExit();
    }
  };
