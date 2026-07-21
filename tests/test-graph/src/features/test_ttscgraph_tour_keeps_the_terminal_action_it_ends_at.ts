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
 * Verifies the hub cut cannot empty a flow or leave a step dangling.
 *
 * The cut removes a declaration reached from a dozen-plus sites that drives no
 * execution onward. A shared type or leaf helper has that shape, and so does
 * every terminal action — a commit, a send, an audit write — which is the point
 * where the flow performs its work. Degree cannot tell the two apart, so the
 * cut stays and yields in the two shapes where it would destroy the flow rather
 * than tidy it: it never removes every hop, and it never removes a hop into a
 * node the flow continues past.
 *
 * Both shapes are built here at exactly the threshold, twelve in-edges.
 * `auditWrite` is a whole flow's only hop, which used to be discarded whole:
 * eleven callers kept the flow and a twelfth erased it. `commitTx` sits
 * mid-chain, where the hop into it was removed while the hop out of it survived
 * and narrated a step from a node the same flow reported it never reached.
 *
 * The negative twin lives in `test_ttscgraph_serves_graph_tools_over_mcp`: a
 * `log` helper with these same degrees, sitting beside five sibling hops that
 * survive, is still cut.
 *
 * 1. Build a project with a sole-hop terminal action and a mid-chain one, each at
 *    twelve in-edges.
 * 2. Ask for a tour seeded on both entrypoints.
 * 3. Assert the sole-hop flow keeps its endpoint, and that every step in every
 *    flow starts at a symbol that flow says it reached.
 */
export const test_ttscgraph_tour_keeps_the_terminal_action_it_ends_at =
  async () => {
    // Eleven each; `Service.handle` and `Service.report` are the twelfth, which
    // puts both actions exactly at the `in >= 12` threshold.
    const callersOf = (name: string, target: string) =>
      Array.from({ length: 11 }, (_unused, index) =>
        [
          `export function ${name}${index}(): void {`,
          `  ${target}();`,
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
        // Terminal: called from many sites, calls nothing onward.
        "export function auditWrite(): void {}",
        // Mid-chain: the same fan-in, one outgoing execution edge, so it is
        // still a hub by degree and the flow continues past it.
        "export function flushBuffer(): void {}",
        "export function commitTx(): void {",
        "  flushBuffer();",
        "}",
        "",
        ...callersOf("auditCaller", "auditWrite"),
        ...callersOf("commitCaller", "commitTx"),
        "export class Service {",
        "  public handle(): void {",
        "    auditWrite();",
        "  }",
        "  public report(): void {",
        "    commitTx();",
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
          thinking:
            "I'm new here; show me what Service.handle and Service.report do.",
          // `reinterpretations` is a required field. Naming the two entrypoints
          // is how a caller says which machinery the question is about, and it
          // makes the flows under test deterministic rather than dependent on
          // structural ranking in a fixture built to have two equal peaks.
          request: {
            type: "tour",
            reinterpretations: ["Service.handle", "Service.report"],
          },
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
      // The sole hop of its flow: cutting it left nothing, and the whole flow
      // was discarded rather than shortened.
      assert.ok(
        names.includes("auditWrite"),
        `the terminal action a flow's only hop lands on must survive: ${names.join(", ")}`,
      );
      // Mid-chain: the flow continues past it, so the hop into it stays and the
      // step out of it has both ends represented.
      assert.ok(
        names.includes("commitTx"),
        `a hub the flow continues past must keep its inbound hop: ${names.join(", ")}`,
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
