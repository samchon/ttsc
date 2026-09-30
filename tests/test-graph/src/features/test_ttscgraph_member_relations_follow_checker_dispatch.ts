import { TestProject } from "@ttsc/testing";

import { dumpGraph, findEdge } from "../internal/graphDump";
import { TtsgraphClient, assert } from "../internal/ttsgraph";

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
 * 1. Build one valid and one signature-incompatible Pipeline implementation.
 * 2. Require the shipped binary dump to retain TS2416 and only the valid member
 *    edge.
 * 3. Trace an interface call and require dispatch into Good/accepted while Bad and
 *    rejected remain unreachable.
 *
 * @evidence contracts/testing.md#behavioral-verification The real native dump reports TS2416 yet retains all members, publishes Good's valid implements relation and excludes Bad's incompatible one; MCP dispatch reaches only accepted.
 * @evidence contracts/testing.md#independent-expectations The authored return types independently make Good compatible and Bad incompatible; literal diagnostics, edge presence/absence and accepted/rejected names establish both facts and consequence.
 * @evidence contracts/testing.md#distinguishing-cases Valid and incompatible methods share one contract, so name equality cannot pass the negative control; the graph remains usable despite the compiler diagnostic.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_member_relations_follow_checker_dispatch starts the installed MCP launcher and reaches the native resident graph through stdio; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Actual checker assignability, dump diagnostics and subsequent MCP traversal must agree; a synthetic implements edge cannot test whether the producer rejected Bad.
 * @evidence contracts/e2e.md#shared-execution Dump and MCP consume one fixture and suite binary, but currently use separate producer lifetimes. Combining the observation with a shared producer is pending; no build per method is claimed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fixture owns valid/invalid implementations and diagnostics; dump is synchronous, and MCP stdin ends with exit awaited in finally without an exit-code assertion. The client observes close from construction, rejects pending requests on child failure, and terminates a child that exceeds its exit timeout.
 * @evidence contracts/e2e.md#preserved-coverage TS2416, retained members, valid-edge positive, invalid-edge negative, Good dispatch/accepted and Bad/rejected exclusions all remain executable.
 */
export const test_ttscgraph_member_relations_follow_checker_dispatch =
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
        "export interface Pipeline {",
        "  execute(input: number): void;",
        "}",
        "",
        "export function accepted(): void {}",
        "export function rejected(): void {}",
        "",
        "export class Good implements Pipeline {",
        "  execute(input: number): void {",
        "    accepted();",
        "  }",
        "}",
        "",
        "export class Bad implements Pipeline {",
        "  execute(input: string): void {",
        "    rejected();",
        "  }",
        "}",
        "",
        "export class Runner {",
        "  constructor(private readonly pipeline: Pipeline) {}",
        "",
        "  run(): void {",
        "    this.pipeline.execute(1);",
        "  }",
        "}",
        "",
      ].join("\n"),
    });

    const dump = dumpGraph(root, "tsconfig.json");
    assert.ok(
      dump.diagnostics.some((diagnostic) => diagnostic.code === 2416),
      "the same dump retains TS2416: " + JSON.stringify(dump.diagnostics),
    );
    const implementations = dump.nodes.filter(
      (node) =>
        node.file === "src/app.ts" &&
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
      (node) => node.qualifiedName === "Pipeline.execute",
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
        arguments: {
          question: "What does Runner.run actually execute?",
          draft: {
            reason: "Follow the interface call into checker-valid bodies.",
            type: "trace",
          },
          review: "Keep the execution trace and its dispatch evidence.",
          request: {
            type: "trace",
            from: "Runner.run",
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
    } finally {
      client.endStdin();
      await client.waitForExit();
    }
  };
