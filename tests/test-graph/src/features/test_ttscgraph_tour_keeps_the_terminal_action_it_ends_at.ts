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

const TSCONFIG = JSON.stringify(
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
);

/** Eleven callers, so a twelfth call site puts the target at the threshold. */
const callersOf = (name: string, target: string): string[] =>
  Array.from({ length: 11 }, (_unused, index) =>
    [
      `export function ${name}${index}(): void {`,
      `  ${target}();`,
      "}",
      "",
    ].join("\n"),
  );

/** Ask the resident server for a tour of `source`, seeded on `names`. */
const tourOfProject = async (
  source: string,
  names: string[],
): Promise<TourResult> => {
  const root = TestProject.createProject({
    "tsconfig.json": TSCONFIG,
    "src/app.ts": source,
  });
  const client = TtsgraphClient.start(root);
  try {
    await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test-graph", version: "0.0.0" },
    });
    client.notify("notifications/initialized", {});
    return tourOf(
      (await client.request("tools/call", {
        name: "inspect_typescript_graph",
        arguments: graphArguments({
          thinking: `I'm new here; show me what ${names.join(" and ")} do.`,
          request: { type: "tour", reinterpretations: names },
        }),
      })) as ToolResult,
    );
  } finally {
    client.endStdin();
    await client.waitForExit();
  }
};

/** Every symbol every flow says it reached, plus every flow's start. */
const reachedNames = (tour: TourResult): string[] =>
  tour.primaryFlow.flatMap((flow) => [
    flow.start.name,
    ...flow.reached.map((node) => node.name),
  ]);

/**
 * Verifies the hub cut cannot empty a flow or leave a step dangling.
 *
 * The cut removes a declaration reached from a dozen-plus sites that drives no
 * execution onward. A shared type or leaf helper has that shape, and so does
 * every terminal action — a commit, a send, an audit write — which is the point
 * where the flow performs its work. Degree cannot tell the two apart, so the
 * cut decides only what is noise and the two shapes where deleting a node would
 * destroy the flow are handled without deciding:
 *
 * - A hop into a node the flow continues past is never removed, so no step
 *   narrates a chain from a node the same flow says it never reached;
 * - A flow the cut would empty is demoted rather than deleted — held back, and
 *   told only when the tour finishes with nothing else to say.
 *
 * Each shape needs its own project, which is the point of demotion: a sole-hop
 * terminal action is told **because** its tour has no other flow, and it must
 * not displace one. The negative twin is in
 * `test_ttscgraph_serves_graph_tools_over_mcp`, where a `log` helper with these
 * same degrees sits in a tour that has real chains to tell, and stays absent.
 *
 * 1. Tour a project whose only flow is one hop into a terminal action at twelve
 *    in-edges, and assert the action survives.
 * 2. Tour a project where a hub of the same degree sits mid-chain, and assert the
 *    hop INTO it is the surviving step.
 * 3. Assert in both that every step starts at a symbol its flow reached.
 */
export const test_ttscgraph_tour_keeps_the_terminal_action_it_ends_at =
  async () => {
    // Eleven callers plus `Service.handle` put `auditWrite` at exactly twelve,
    // and nothing in this project drives a longer chain, so the whole tour is
    // hop-into-a-hub. Eleven callers kept the flow and a twelfth erased it.
    const terminal = await tourOfProject(
      [
        "export function auditWrite(): void {}",
        "",
        ...callersOf("auditCaller", "auditWrite"),
        "export class Service {",
        "  public handle(): void {",
        "    auditWrite();",
        "  }",
        "}",
        "",
      ].join("\n"),
      ["Service.handle"],
    );
    assert.ok(
      reachedNames(terminal).includes("auditWrite"),
      `a flow whose only hop lands on a terminal action must survive: ${JSON.stringify(terminal.primaryFlow)}`,
    );

    // `commitTx` carries the same fan-in with one outgoing execution edge, so
    // it is still a hub by degree and the flow continues past it.
    const midChain = await tourOfProject(
      [
        "export function flushBuffer(): void {}",
        "export function commitTx(): void {",
        "  flushBuffer();",
        "}",
        "",
        ...callersOf("commitCaller", "commitTx"),
        "export class Service {",
        "  public report(): void {",
        "    commitTx();",
        "  }",
        "}",
        "",
      ].join("\n"),
      ["Service.report"],
    );
    // Asserted on the step, not on `reached`: `reached` is derived from BOTH
    // endpoints of every kept hop, so `commitTx` appears there even when only
    // the hop OUT of it survived — which is the incoherent shape this rule
    // exists to prevent, and an assertion that cannot see it proves nothing.
    const steps = midChain.primaryFlow.flatMap((flow) => flow.steps);
    assert.ok(
      steps.some((step) => step.includes("-> commitTx")),
      `a hub the flow continues past must keep its inbound hop: ${steps.join(" | ")}`,
    );

    // Every step names two symbols, and both have to be reachable as handles in
    // the same flow. A dangling step is what breaks that.
    for (const tour of [terminal, midChain])
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
  };
