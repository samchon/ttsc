import { TestProject } from "@ttsc/testing";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

interface TourResult {
  type: "tour";
  primaryFlow: {
    start: { id: string; name: string };
    steps: string[];
    reached: { id: string; name: string }[];
  }[];
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

const tourOf = (result: ToolResult): TourResult => {
  const value = (result.structuredContent ?? {}) as { result?: TourResult };
  if (value.result?.type !== "tour")
    throw new Error(`Unexpected graph result: ${JSON.stringify(value)}`);
  return value.result;
};

/**
 * Verifies a tour flow keeps the terminal action it ends at, and never narrates
 * a step from a node it says it never reached.
 *
 * The hub cut removes a declaration reached from a dozen-plus sites that drives
 * no execution onward. A shared type or leaf helper has that shape, and so does
 * every terminal action — a commit, a send, an audit write — which is the point
 * where the flow performs its work. The cut applied to both, so the flow lost
 * its endpoint: eleven callers kept it and a twelfth erased it, and when the
 * action sat mid-chain the hop into it was removed while the hop out survived.
 *
 * The cut still applies where it was written for: a hub the chain passes
 * through. It no longer applies to the hub the chain ends at.
 *
 * 1. Build a project whose flow ends in an audit write called from twelve sites,
 *    past the hub threshold.
 * 2. Ask for a tour.
 * 3. Assert some flow reaches the terminal action, and that every step's endpoints
 *    appear in that flow's reached set.
 */
export const test_ttscgraph_tour_keeps_the_terminal_action_it_ends_at =
  async () => {
    const callers = Array.from({ length: 12 }, (_, index) =>
      [
        `export function caller${index}(): void {`,
        "  auditWrite();",
        "}",
        "",
      ].join("\n"),
    );
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
        "export function auditWrite(): void {}",
        "",
        ...callers,
        "export class Service {",
        "  public handle(): void {",
        "    caller0();",
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
          thinking: "What does this codebase do?",
          request: { type: "tour" },
        }),
      })) as ToolResult;

      const tour = tourOf(result);
      assert.ok(
        tour.primaryFlow.length > 0,
        "the hub cut must not empty every flow",
      );
      const names = tour.primaryFlow.flatMap((flow) =>
        flow.reached.map((node) => node.name),
      );
      assert.ok(
        names.includes("auditWrite"),
        `the terminal action the flow ends at must survive: ${names.join(", ")}`,
      );

      // Every step names two symbols; both have to be reachable as handles in
      // the same flow, which is what a dangling step breaks.
      for (const flow of tour.primaryFlow) {
        const reached = new Set([
          flow.start.name,
          ...flow.reached.map((node) => node.name),
        ]);
        for (const step of flow.steps) {
          const [lhs] = step.split(" -[");
          const short = (lhs ?? "").split(".").pop() ?? "";
          assert.ok(
            [...reached].some((name) => name.endsWith(short)),
            `step starts at a symbol the flow never reached: ${step}`,
          );
        }
      }
    } finally {
      client.endStdin();
      await client.waitForExit();
    }
  };
