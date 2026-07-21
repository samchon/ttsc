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

const SELF_RECURSIVE = [
  "export function retry(): void {",
  "  retry();",
  "}",
  "",
].join("\n");

const REAL_FLOW = [
  "export function work(): void {}",
  "export function handle(): void {",
  "  work();",
  "}",
  "",
].join("\n");

/**
 * Verifies one self-recursive function cannot silence the flows ranked after
 * it.
 *
 * `runTour` deduplicates flows by comparing where each candidate landed against
 * what it has already told, and `overlaps` reported a match whenever the
 * smaller of the two sets was empty. `told` is a candidate for "smaller", so
 * one empty set entering it made every later candidate a synonym of nothing.
 *
 * A directly self-recursive function produces exactly that set: `runTrace`
 * records a back-edge to the start as a hop without adding a node, because the
 * start travels separately, so the flow had a hop and reached nobody. The tour
 * then published one flow that said it went nowhere and discarded every real
 * flow behind it. Recursion is ordinary — a retry loop, a tree walk, a parser's
 * descent — so this was not an exotic input.
 *
 * 1. Tour a project holding a self-recursive function and a real two-hop chain.
 * 2. Assert the real chain is reported.
 * 3. Assert no flow was published with an empty `reached`.
 * 4. Tour the same project without the self-recursive function and assert the real
 *    chain is reported identically, so its presence changes nothing.
 */
export const test_ttscgraph_tour_keeps_flows_after_a_self_recursive_seed =
  async () => {
    const withRecursion = await tourOfProject(`${SELF_RECURSIVE}${REAL_FLOW}`, [
      "retry",
      "handle",
    ]);

    const reaches = (tour: TourResult, name: string): boolean =>
      tour.primaryFlow.some((flow) =>
        flow.reached.some((node) => node.name === name),
      );

    assert.ok(
      reaches(withRecursion, "work"),
      `the real chain must survive a self-recursive seed: ${JSON.stringify(withRecursion.primaryFlow)}`,
    );
    for (const flow of withRecursion.primaryFlow)
      assert.ok(
        flow.reached.length > 0,
        `a flow that reached nothing was published: ${JSON.stringify(flow)}`,
      );

    // The negative twin, and the reason the assertions above prove anything:
    // the same project without the recursion must give the same real flow, so
    // the recursion's presence is what is being measured rather than the
    // fixture happening to rank `handle` first.
    const withoutRecursion = await tourOfProject(REAL_FLOW, ["handle"]);
    assert.ok(
      reaches(withoutRecursion, "work"),
      `the control project must report the same chain: ${JSON.stringify(withoutRecursion.primaryFlow)}`,
    );
  };
